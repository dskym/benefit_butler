# backend/tests/test_catalog_seed.py
"""카드 카탈로그 시드 로더 테스트.

  - 시드 파일 적재/멱등성
  - 가맹점 별칭 정규화
  - 혜택-가맹점 조인 링크
  - 시드 정합성 검증(미등록 가맹점 참조, 카테고리 오류)
  - 카탈로그 API의 benefits 포함 응답
"""
import json
import uuid

import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.card_benefit import CatalogBenefit, CatalogBenefitMerchant
from app.models.card_catalog import CardCatalog
from app.models.merchant import Merchant, MerchantAlias
from app.services.catalog_seed import DEFAULT_SEED_PATH, SeedValidationError, load_catalog_seed
from app.services.merchant_resolver import normalize_merchant_name


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def _table_counts(db):
    return {
        "merchants": db.scalar(select(func.count()).select_from(Merchant)),
        "aliases": db.scalar(select(func.count()).select_from(MerchantAlias)),
        "cards": db.scalar(select(func.count()).select_from(CardCatalog)),
        "benefits": db.scalar(select(func.count()).select_from(CatalogBenefit)),
        "links": db.scalar(select(func.count()).select_from(CatalogBenefitMerchant)),
    }


# ── 적재/멱등성 ────────────────────────────────────────────────────────────────


def test_seed_loads_all_sections(db):
    counts = load_catalog_seed(db)
    assert counts["merchants"] > 0
    assert counts["cards"] == 15
    assert counts["benefits"] > 0

    table_counts = _table_counts(db)
    assert table_counts["merchants"] == counts["merchants"]
    assert table_counts["cards"] == counts["cards"]
    assert table_counts["benefits"] == counts["benefits"]
    assert table_counts["links"] > 0  # merchant 타겟 혜택이 존재


def test_seed_is_idempotent(db):
    load_catalog_seed(db)
    first = _table_counts(db)
    card_ids_first = set(db.scalars(select(CardCatalog.id)).all())

    load_catalog_seed(db)
    second = _table_counts(db)
    card_ids_second = set(db.scalars(select(CardCatalog.id)).all())

    assert first == second
    assert card_ids_first == card_ids_second  # 카드 UUID 안정성 (user_cards.catalog_id 링크 보존)


def test_seed_preserves_existing_card_id_links(db):
    """upsert 방식이므로 기존 카드 행이 delete-insert 되지 않아야 한다."""
    load_catalog_seed(db)
    known_id = uuid.UUID("11111111-0001-0001-0001-000000000001")
    card = db.get(CardCatalog, known_id)
    assert card is not None
    assert card.name == "Deep Dream 카드"


# ── 별칭/가맹점 링크 ──────────────────────────────────────────────────────────


def test_merchant_aliases_are_normalized(db):
    load_catalog_seed(db)
    starbucks = db.scalar(select(Merchant).where(Merchant.name == "스타벅스"))
    assert starbucks is not None
    assert starbucks.category == "식비"

    aliases = set(
        db.scalars(select(MerchantAlias.alias_normalized).where(MerchantAlias.merchant_id == starbucks.id)).all()
    )
    assert "스타벅스" in aliases  # 대표명 자체도 별칭으로 등록
    assert "스벅" in aliases
    assert "starbucks" in aliases
    for alias in aliases:
        assert alias == normalize_merchant_name(alias)  # 이미 정규형


def test_merchant_benefit_links_created(db):
    load_catalog_seed(db)
    # taptap O의 "스타벅스 50%" 혜택이 스타벅스 가맹점에 연결됨
    taptap_id = uuid.UUID("11111111-0001-0001-0001-000000000005")
    benefit = db.scalar(
        select(CatalogBenefit).where(
            CatalogBenefit.catalog_id == taptap_id,
            CatalogBenefit.target_type == "merchant",
            CatalogBenefit.rate == 50.0,
        )
    )
    assert benefit is not None
    assert benefit.merchant_names == ["스타벅스"]
    assert benefit.requires_performance is True
    assert benefit.category is None


def test_all_target_benefits_have_no_category(db):
    load_catalog_seed(db)
    rows = list(db.scalars(select(CatalogBenefit).where(CatalogBenefit.target_type == "all")).all())
    assert rows
    for b in rows:
        assert b.category is None
        assert b.merchant_names == []


# ── 정합성 검증 ───────────────────────────────────────────────────────────────


def _base_seed() -> dict:
    return json.loads(DEFAULT_SEED_PATH.read_text(encoding="utf-8"))


def test_seed_rejects_unknown_merchant_reference(db, tmp_path):
    data = _base_seed()
    data["cards"][0]["benefits"].append(
        {"title": "bad", "target": {"type": "merchant", "merchants": ["존재하지않는가맹점"]}, "benefit_type": "cashback", "rate": 1.0}
    )
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(SeedValidationError, match="미등록 가맹점"):
        load_catalog_seed(db, bad)


def test_seed_rejects_unknown_category(db, tmp_path):
    data = _base_seed()
    data["merchants"][0]["category"] = "없는카테고리"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(SeedValidationError, match="BENEFIT_CATEGORIES"):
        load_catalog_seed(db, bad)


def test_seed_rejects_empty_merchant_target(db, tmp_path):
    data = _base_seed()
    data["cards"][0]["benefits"].append(
        {"title": "empty", "target": {"type": "merchant", "merchants": []}, "benefit_type": "cashback", "rate": 1.0}
    )
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(SeedValidationError, match="비어 있음"):
        load_catalog_seed(db, bad)


# ── normalize_merchant_name ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("스타벅스", "스타벅스"),
        ("스타벅스 강남점", "스타벅스강남"),
        ("(주)스타벅스코리아", "스타벅스코리아"),
        ("[신한카드] 스타벅스", "스타벅스"),
        ("Starbucks Coffee", "starbuckscoffee"),
        ("GS25 역삼점", "gs25역삼"),
        ("S-OIL", "soil"),
    ],
)
def test_normalize_merchant_name(raw, expected):
    assert normalize_merchant_name(raw) == expected


# ── 카탈로그 API ──────────────────────────────────────────────────────────────


def test_catalog_api_includes_benefits(client, db):
    load_catalog_seed(db)
    resp = client.get("/api/v1/cards/catalog/?q=taptap")
    assert resp.status_code == 200
    cards = resp.json()
    assert len(cards) == 1
    benefits = cards[0]["benefits"]
    assert len(benefits) > 0
    starbucks_benefit = next(b for b in benefits if b["rate"] == 50.0)
    assert starbucks_benefit["target_type"] == "merchant"
    assert starbucks_benefit["merchant_names"] == ["스타벅스"]
    assert starbucks_benefit["requires_performance"] is True
    all_benefit = [b for b in benefits if b["target_type"] == "all"]
    category_benefit = [b for b in benefits if b["target_type"] == "category"]
    assert category_benefit  # 교통/통신/쇼핑 카테고리 혜택 존재
    assert all(b["category"] is None for b in all_benefit)


def test_catalog_detail_includes_benefits(client, db):
    load_catalog_seed(db)
    resp = client.get("/api/v1/cards/catalog/11111111-0001-0001-0001-000000000001")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Deep Dream 카드"
    assert len(body["benefits"]) == 4
