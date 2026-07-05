# backend/tests/test_merchants.py
"""Tests for /api/v1/merchants/* endpoints.

lookup은 로컬 가맹점 사전 우선, 미스 시 Naver Local API 폴백으로 동작한다.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.core.database import SessionLocal
from app.models.merchant import Merchant, MerchantAlias
from app.services.merchant_resolver import normalize_merchant_name


def _seed_merchant(name, category, aliases=()):
    db = SessionLocal()
    try:
        merchant = Merchant(name=name, category=category)
        db.add(merchant)
        db.flush()
        for alias in {normalize_merchant_name(name), *(normalize_merchant_name(a) for a in aliases)}:
            db.add(MerchantAlias(merchant_id=merchant.id, alias_normalized=alias))
        db.commit()
        return str(merchant.id)
    finally:
        db.close()


def test_lookup_returns_available_categories(client, auth_headers):
    """GET /merchants/lookup?q=... always includes available_categories."""
    resp = client.get("/api/v1/merchants/lookup?q=스타벅스", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "available_categories" in data
    assert len(data["available_categories"]) > 0
    assert "식비" in data["available_categories"]
    assert "전체" not in data["available_categories"]  # "전체"는 target_type="all"로 흡수됨


def test_lookup_local_dictionary_hit(client, auth_headers):
    """로컬 사전에 있는 가맹점은 Naver 없이 즉시 해석된다."""
    merchant_id = _seed_merchant("스타벅스", "식비", ["스벅"])
    resp = client.get("/api/v1/merchants/lookup?q=스벅", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["merchant_id"] == merchant_id
    assert data["merchant_name"] == "스타벅스"
    assert data["category"] == "식비"
    assert data["source"] == "alias"
    assert data["confidence"] == 1.0


def test_lookup_local_partial_hit(client, auth_headers):
    _seed_merchant("스타벅스", "식비")
    resp = client.get("/api/v1/merchants/lookup?q=스타벅스 강남점", headers=auth_headers)
    data = resp.json()
    assert data["merchant_name"] == "스타벅스"
    assert data["source"] == "partial"


def test_lookup_naver_not_configured_returns_none_source(client, auth_headers):
    """로컬 미스 + NAVER 미설정 → source='none', category=None."""
    resp = client.get("/api/v1/merchants/lookup?q=동네백반집", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["merchant_id"] is None
    assert data["category"] is None
    assert data["source"] == "none"
    assert data["confidence"] == 0.0


def test_lookup_missing_q_returns_422(client, auth_headers):
    """q is required query param."""
    resp = client.get("/api/v1/merchants/lookup", headers=auth_headers)
    assert resp.status_code == 422


def _mock_naver_client(json_value=None, error=None):
    mock_client = AsyncMock()
    if error is not None:
        mock_client.get = AsyncMock(side_effect=error)
    else:
        mock_response = MagicMock()
        mock_response.json.return_value = json_value
        mock_response.raise_for_status = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def test_lookup_naver_fallback_success(client, auth_headers, monkeypatch):
    """로컬 미스 시 Naver 결과의 카테고리로 폴백 (source='naver')."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock = _mock_naver_client({"items": [{"category": "음식점>카페>동네카페"}]})
    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock):
        resp = client.get("/api/v1/merchants/lookup?q=동네카페", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["merchant_id"] is None
    assert data["category"] == "식비"
    assert data["source"] == "naver"
    assert data["confidence"] == 0.5


def test_lookup_local_hit_skips_naver(client, auth_headers, monkeypatch):
    """로컬 히트면 Naver가 설정돼 있어도 호출하지 않는다."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")
    _seed_merchant("쿠팡", "쇼핑")

    mock = _mock_naver_client({"items": [{"category": "쇼핑>온라인"}]})
    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock):
        resp = client.get("/api/v1/merchants/lookup?q=쿠팡", headers=auth_headers)

    assert resp.json()["source"] == "alias"
    mock.get.assert_not_called()


def test_lookup_naver_api_empty_results(client, auth_headers, monkeypatch):
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock = _mock_naver_client({"items": []})
    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock):
        resp = client.get("/api/v1/merchants/lookup?q=알수없는곳", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] is None
    assert data["source"] == "none"


def test_lookup_naver_unrecognized_category(client, auth_headers, monkeypatch):
    """Naver 카테고리가 내부 카테고리로 매핑 안 되면 category=None."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock = _mock_naver_client({"items": [{"category": "기타서비스>세탁소"}]})
    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock):
        resp = client.get("/api/v1/merchants/lookup?q=세탁소", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["category"] is None


def test_lookup_naver_api_error_graceful(client, auth_headers, monkeypatch):
    """Naver API 오류 시 우아한 실패 (source='none')."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock = _mock_naver_client(error=httpx.HTTPError("connection error"))
    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock):
        resp = client.get("/api/v1/merchants/lookup?q=동네백반집", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] is None
    assert data["source"] == "none"
