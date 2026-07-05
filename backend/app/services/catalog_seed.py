"""카드 카탈로그 시드 로더.

app/data/card_catalog_seed.json을 DB에 적재한다. 멱등(idempotent):
  - merchants: name 기준 upsert, 별칭은 merchant별 delete-reinsert
  - card_catalog: id 기준 upsert
  - catalog_benefits: 카드별 delete-reinsert (user_card_benefits로 스냅샷 복사되므로
    외부에서 catalog_benefits.id를 참조하지 않는다)

CLI: cd backend && python -m scripts.seed_catalog
"""
import json
import uuid
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.constants import BENEFIT_CATEGORIES, BENEFIT_TARGET_TYPES
from app.models.card_benefit import CatalogBenefit, CatalogBenefitMerchant
from app.models.card_catalog import CardCatalog
from app.models.merchant import Merchant, MerchantAlias
from app.services.merchant_resolver import normalize_merchant_name

DEFAULT_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "card_catalog_seed.json"


class SeedValidationError(ValueError):
    pass


def _validate(data: dict) -> None:
    merchant_names = {m["name"] for m in data["merchants"]}
    for m in data["merchants"]:
        if m["category"] not in BENEFIT_CATEGORIES:
            raise SeedValidationError(f"가맹점 '{m['name']}'의 카테고리 '{m['category']}'가 BENEFIT_CATEGORIES에 없음")
    for card in data["cards"]:
        for b in card["benefits"]:
            target = b["target"]
            ttype = target["type"]
            if ttype not in BENEFIT_TARGET_TYPES:
                raise SeedValidationError(f"카드 '{card['name']}' 혜택 '{b.get('title')}'의 target.type '{ttype}' 불명")
            if ttype == "category":
                if target.get("category") not in BENEFIT_CATEGORIES:
                    raise SeedValidationError(
                        f"카드 '{card['name']}' 혜택 '{b.get('title')}'의 카테고리 '{target.get('category')}' 불명"
                    )
            if ttype == "merchant":
                missing = set(target.get("merchants", [])) - merchant_names
                if not target.get("merchants"):
                    raise SeedValidationError(f"카드 '{card['name']}' 혜택 '{b.get('title')}'의 merchants가 비어 있음")
                if missing:
                    raise SeedValidationError(
                        f"카드 '{card['name']}' 혜택 '{b.get('title')}'가 미등록 가맹점 참조: {sorted(missing)}"
                    )


def _upsert_merchants(db: Session, merchants: list[dict]) -> dict[str, uuid.UUID]:
    ids: dict[str, uuid.UUID] = {}
    for entry in merchants:
        merchant = db.scalar(select(Merchant).where(Merchant.name == entry["name"]))
        if merchant is None:
            merchant = Merchant(name=entry["name"], category=entry["category"])
            db.add(merchant)
            db.flush()
        else:
            merchant.category = entry["category"]
        ids[entry["name"]] = merchant.id

        db.execute(delete(MerchantAlias).where(MerchantAlias.merchant_id == merchant.id))
        aliases = {normalize_merchant_name(entry["name"])}
        aliases |= {normalize_merchant_name(a) for a in entry.get("aliases", [])}
        for alias in sorted(a for a in aliases if a):
            db.add(MerchantAlias(merchant_id=merchant.id, alias_normalized=alias))
    return ids


def _upsert_cards(db: Session, cards: list[dict], merchant_ids: dict[str, uuid.UUID]) -> int:
    benefit_count = 0
    for entry in cards:
        card_id = uuid.UUID(entry["id"])
        card = db.get(CardCatalog, card_id)
        if card is None:
            card = CardCatalog(id=card_id)
            db.add(card)
        card.name = entry["name"]
        card.issuer = entry["issuer"]
        card.card_type = entry["card_type"]
        card.image_url = entry.get("image_url")
        card.is_active = entry.get("is_active", True)
        db.flush()

        # FK ondelete=CASCADE가 조인 테이블 행도 함께 제거
        db.execute(delete(CatalogBenefit).where(CatalogBenefit.catalog_id == card_id))
        for b in entry["benefits"]:
            target = b["target"]
            benefit = CatalogBenefit(
                catalog_id=card_id,
                title=b.get("title"),
                target_type=target["type"],
                category=target.get("category"),
                benefit_type=b["benefit_type"],
                rate=b.get("rate"),
                flat_amount=b.get("flat_amount"),
                monthly_cap=b.get("monthly_cap"),
                min_amount=b.get("min_amount"),
                requires_performance=b.get("requires_performance", False),
            )
            db.add(benefit)
            db.flush()
            benefit_count += 1
            for name in target.get("merchants", []):
                db.add(CatalogBenefitMerchant(benefit_id=benefit.id, merchant_id=merchant_ids[name]))
    return benefit_count


def load_catalog_seed(db: Session, path: Path = DEFAULT_SEED_PATH) -> dict[str, int]:
    """시드 파일을 적재하고 {merchants, cards, benefits} 카운트를 반환."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    _validate(data)

    merchant_ids = _upsert_merchants(db, data["merchants"])
    benefit_count = _upsert_cards(db, data["cards"], merchant_ids)
    db.commit()
    return {
        "merchants": len(merchant_ids),
        "cards": len(data["cards"]),
        "benefits": benefit_count,
    }
