# backend/tests/test_merchant_resolver.py
"""merchant_resolver 서비스 단위 테스트.

  - resolve_merchant_local: 정확/부분 일치, 최장 별칭 우선, 미스
  - resolve_merchant: 로컬 우선, Naver 폴백(monkeypatch)
  - get_or_create_merchants: 별칭/대표명 매칭, 자동 생성, 중복 제거
"""
import asyncio

import pytest

from app.core.database import SessionLocal
from app.models.merchant import Merchant, MerchantAlias
from app.services import merchant_resolver
from app.services.merchant_resolver import (
    get_or_create_merchants,
    normalize_merchant_name,
    resolve_merchant,
    resolve_merchant_local,
)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def _add_merchant(db, name, category, aliases=()):
    merchant = Merchant(name=name, category=category)
    db.add(merchant)
    db.flush()
    for alias in {normalize_merchant_name(name), *(normalize_merchant_name(a) for a in aliases)}:
        db.add(MerchantAlias(merchant_id=merchant.id, alias_normalized=alias))
    db.commit()
    return merchant


# ── resolve_merchant_local ────────────────────────────────────────────────────


def test_exact_alias_match(db):
    m = _add_merchant(db, "스타벅스", "식비", ["스벅", "starbucks"])
    result = resolve_merchant_local(db, "스벅")
    assert result is not None
    assert result.merchant_id == m.id
    assert result.merchant_name == "스타벅스"
    assert result.category == "식비"
    assert result.source == "alias"
    assert result.confidence == 1.0


def test_exact_match_normalizes_input(db):
    m = _add_merchant(db, "스타벅스", "식비")
    result = resolve_merchant_local(db, "[신한카드] (주)스타벅스")
    assert result is not None
    assert result.merchant_id == m.id
    assert result.source == "alias"


def test_partial_match_branch_name(db):
    m = _add_merchant(db, "스타벅스", "식비")
    result = resolve_merchant_local(db, "스타벅스 역삼점")
    assert result is not None
    assert result.merchant_id == m.id
    assert result.source == "partial"
    assert result.confidence == 0.7


def test_partial_match_longest_alias_wins(db):
    _add_merchant(db, "이마트", "쇼핑")
    emart24 = _add_merchant(db, "이마트24", "쇼핑")
    result = resolve_merchant_local(db, "이마트24 성수점")
    assert result is not None
    assert result.merchant_id == emart24.id


def test_local_miss_returns_none(db):
    _add_merchant(db, "스타벅스", "식비")
    assert resolve_merchant_local(db, "동네백반집") is None


def test_query_too_short_returns_none(db):
    _add_merchant(db, "스타벅스", "식비")
    assert resolve_merchant_local(db, "스") is None


# ── resolve_merchant (Naver 폴백) ─────────────────────────────────────────────


def test_resolve_prefers_local_over_naver(db, monkeypatch):
    m = _add_merchant(db, "스타벅스", "식비")

    async def _fail(_):
        raise AssertionError("로컬 히트 시 Naver를 호출하면 안 됨")

    monkeypatch.setattr(merchant_resolver, "lookup_merchant_category", _fail)
    result = asyncio.run(resolve_merchant(db, "스타벅스"))
    assert result.merchant_id == m.id
    assert result.source == "alias"


def test_resolve_falls_back_to_naver(db, monkeypatch):
    async def _naver(_):
        return {"category": "식비", "raw_category": "음식점>카페"}

    monkeypatch.setattr(merchant_resolver, "lookup_merchant_category", _naver)
    result = asyncio.run(resolve_merchant(db, "동네카페"))
    assert result.merchant_id is None
    assert result.category == "식비"
    assert result.source == "naver"
    assert result.confidence == 0.5


def test_resolve_total_miss(db, monkeypatch):
    async def _naver(_):
        return {"category": None, "raw_category": None}

    monkeypatch.setattr(merchant_resolver, "lookup_merchant_category", _naver)
    result = asyncio.run(resolve_merchant(db, "동네백반집"))
    assert result.merchant_id is None
    assert result.category is None
    assert result.source == "none"
    assert result.confidence == 0.0


# ── get_or_create_merchants ───────────────────────────────────────────────────


def test_get_or_create_matches_existing_by_alias(db):
    m = _add_merchant(db, "스타벅스", "식비", ["스벅"])
    result = get_or_create_merchants(db, ["스벅"], default_category="쇼핑")
    assert [r.id for r in result] == [m.id]
    assert result[0].category == "식비"  # 기존 카테고리 유지


def test_get_or_create_creates_new_with_default_category(db):
    result = get_or_create_merchants(db, ["새로운가게"], default_category="식비")
    db.commit()
    assert len(result) == 1
    assert result[0].name == "새로운가게"
    assert result[0].category == "식비"
    # 별칭이 등록되어 이후 resolve 가능
    resolved = resolve_merchant_local(db, "새로운가게")
    assert resolved is not None
    assert resolved.merchant_id == result[0].id


def test_get_or_create_dedupes_and_skips_blank(db):
    result = get_or_create_merchants(db, ["가게A", "가게A", "  ", ""], default_category="쇼핑")
    db.commit()
    assert len(result) == 1
