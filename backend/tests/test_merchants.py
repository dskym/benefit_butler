# backend/tests/test_merchants.py
"""Tests for /api/v1/merchants/* endpoints."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx


def test_lookup_returns_available_categories(client, auth_headers):
    """GET /merchants/lookup?q=... always includes available_categories."""
    resp = client.get("/api/v1/merchants/lookup?q=스타벅스", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "available_categories" in data
    assert len(data["available_categories"]) > 0
    assert "식비" in data["available_categories"]


def test_lookup_naver_not_configured_returns_null_category(client, auth_headers):
    """Without NAVER_CLIENT_ID env, category should be None."""
    resp = client.get("/api/v1/merchants/lookup?q=스타벅스", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] is None
    assert data["raw_category"] is None


def test_lookup_missing_q_returns_422(client, auth_headers):
    """q is required query param."""
    resp = client.get("/api/v1/merchants/lookup", headers=auth_headers)
    assert resp.status_code == 422


def test_lookup_naver_api_success(client, auth_headers, monkeypatch):
    """With mocked Naver API returning a food result, category should map to 식비."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "items": [{"category": "음식점>카페>스타벅스"}]
    }
    mock_response.raise_for_status = MagicMock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock_client_instance):
        resp = client.get("/api/v1/merchants/lookup?q=스타벅스", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] == "식비"
    assert data["raw_category"] == "음식점>카페>스타벅스"


def test_lookup_naver_api_empty_results(client, auth_headers, monkeypatch):
    """Naver API returns empty items list -> category=None."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock_response = MagicMock()
    mock_response.json.return_value = {"items": []}
    mock_response.raise_for_status = MagicMock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock_client_instance):
        resp = client.get("/api/v1/merchants/lookup?q=알수없는곳", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["category"] is None


def test_lookup_naver_unrecognized_category(client, auth_headers, monkeypatch):
    """Naver returns category that doesn't map to internal -> category=None, raw_category preserved."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "items": [{"category": "기타서비스>세탁소"}]
    }
    mock_response.raise_for_status = MagicMock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock_client_instance):
        resp = client.get("/api/v1/merchants/lookup?q=세탁소", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] is None
    assert data["raw_category"] == "기타서비스>세탁소"


def test_lookup_naver_api_error_graceful(client, auth_headers, monkeypatch):
    """Naver API raises error -> graceful degradation (None)."""
    monkeypatch.setenv("NAVER_CLIENT_ID", "fake-id")
    monkeypatch.setenv("NAVER_CLIENT_SECRET", "fake-secret")

    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(side_effect=httpx.HTTPError("connection error"))
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.merchant_lookup.httpx.AsyncClient", return_value=mock_client_instance):
        resp = client.get("/api/v1/merchants/lookup?q=스타벅스", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["category"] is None
    assert data["raw_category"] is None
