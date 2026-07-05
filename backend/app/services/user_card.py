import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.card_benefit import CatalogBenefit, UserCardBenefit, UserCardBenefitMerchant
from app.models.card_catalog import CardCatalog
from app.models.user_card import UserCard
from app.schemas.user_card import CardPerformanceItem, UserCardCreate, UserCardUpdate


# ── Period helpers ────────────────────────────────────────────────────────────


def _last_day_of_month(ref: date) -> date:
    if ref.month == 12:
        return date(ref.year + 1, 1, 1) - timedelta(days=1)
    return date(ref.year, ref.month + 1, 1) - timedelta(days=1)


def _add_months(d: date, n: int) -> date:
    month = d.month + n
    year = d.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    return date(year, month, 1)


def get_performance_period(billing_day: int | None, today: date) -> tuple[date, date]:
    """Return (period_start, period_end) for the current performance period.

    If billing_day is None, returns the current calendar month (1st ~ last day).
    Otherwise shifts the calendar month window by (14 - billing_day) days so that
    billing_day=14 aligns with the calendar month, billing_day<14 shifts later, etc.
    """
    if billing_day is None:
        return today.replace(day=1), _last_day_of_month(today)

    offset = 14 - billing_day  # days to subtract from calendar month boundaries

    def _month_window(ref: date) -> tuple[date, date]:
        start = ref.replace(day=1) - timedelta(days=offset)
        end = _last_day_of_month(ref) - timedelta(days=offset)
        return start, end

    start, end = _month_window(today)
    if start <= today <= end:
        return start, end
    if today > end:
        return _month_window(_add_months(today, 1))
    return _month_window(_add_months(today, -1))


# ── CRUD ──────────────────────────────────────────────────────────────────────


def list_cards(db: Session, user_id: uuid.UUID) -> list[UserCard]:
    return list(
        db.scalars(
            select(UserCard)
            .where(UserCard.user_id == user_id)
            .order_by(UserCard.created_at.asc())
        ).all()
    )


def _get_catalog_or_404(db: Session, catalog_id: uuid.UUID) -> CardCatalog:
    catalog = db.scalar(
        select(CardCatalog).where(CardCatalog.id == catalog_id, CardCatalog.is_active == True)  # noqa: E712
    )
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog card not found")
    return catalog


def copy_catalog_benefits(db: Session, user_card: UserCard, catalog_id: uuid.UUID) -> int:
    """카탈로그 혜택(+가맹점 타겟)을 user_card_benefits로 스냅샷 복사. commit하지 않는다."""
    benefits = list(db.scalars(select(CatalogBenefit).where(CatalogBenefit.catalog_id == catalog_id)).all())
    for cb in benefits:
        ub = UserCardBenefit(
            user_card_id=user_card.id,
            title=cb.title,
            target_type=cb.target_type,
            category=cb.category,
            benefit_type=cb.benefit_type,
            rate=cb.rate,
            flat_amount=cb.flat_amount,
            monthly_cap=cb.monthly_cap,
            min_amount=cb.min_amount,
            requires_performance=cb.requires_performance,
        )
        db.add(ub)
        db.flush()
        for merchant in cb.merchants:
            db.add(UserCardBenefitMerchant(benefit_id=ub.id, merchant_id=merchant.id))
    return len(benefits)


def create_card(db: Session, user_id: uuid.UUID, data: UserCardCreate) -> UserCard:
    if data.catalog_id is not None:
        _get_catalog_or_404(db, data.catalog_id)
    card = UserCard(
        user_id=user_id,
        type=data.type,
        name=data.name,
        monthly_target=data.monthly_target,
        billing_day=data.billing_day,
        catalog_id=data.catalog_id,
    )
    db.add(card)
    db.flush()
    if data.catalog_id is not None:
        copy_catalog_benefits(db, card, data.catalog_id)
    db.commit()
    db.refresh(card)
    return card


def update_card(db: Session, user_id: uuid.UUID, card_id: uuid.UUID, data: UserCardUpdate) -> UserCard:
    card = db.scalar(
        select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    card.monthly_target = data.monthly_target
    card.billing_day = data.billing_day

    updates = data.model_dump(exclude_unset=True)
    if "catalog_id" in updates and updates["catalog_id"] != card.catalog_id:
        new_catalog_id = updates["catalog_id"]
        if new_catalog_id is not None:
            _get_catalog_or_404(db, new_catalog_id)
        # 카탈로그 재연결은 파괴적: 기존 혜택 전부 삭제 후 재복사 (프론트에서 확인 다이얼로그)
        db.execute(delete(UserCardBenefit).where(UserCardBenefit.user_card_id == card.id))
        card.catalog_id = new_catalog_id
        if new_catalog_id is not None:
            copy_catalog_benefits(db, card, new_catalog_id)

    db.commit()
    db.refresh(card)
    return card


def delete_card(db: Session, user_id: uuid.UUID, card_id: uuid.UUID) -> None:
    card = db.scalar(
        select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()


# ── Performance ───────────────────────────────────────────────────────────────


def get_cards_performance(db: Session, user_id: uuid.UUID) -> list[CardPerformanceItem]:
    from app.models.transaction import Transaction  # avoid circular import

    cards = list_cards(db, user_id)
    today = date.today()
    result: list[CardPerformanceItem] = []

    for card in cards:
        start, end = get_performance_period(card.billing_day, today)

        # Convert date range to UTC datetime boundaries
        start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
        end_dt = datetime(
            (end + timedelta(days=1)).year,
            (end + timedelta(days=1)).month,
            (end + timedelta(days=1)).day,
            tzinfo=timezone.utc,
        )

        raw = db.scalar(
            select(func.sum(Transaction.amount)).where(
                Transaction.user_card_id == card.id,
                Transaction.type == "expense",
                Transaction.transacted_at >= start_dt,
                Transaction.transacted_at < end_dt,
            )
        )
        spending = int(raw or 0)
        target = card.monthly_target

        result.append(
            CardPerformanceItem(
                card_id=str(card.id),
                card_name=card.name,
                card_type=card.type,
                monthly_target=target,
                billing_day=card.billing_day,
                period_start=start,
                period_end=end,
                current_spending=spending,
                remaining=max(0, target - spending) if target is not None else None,
                achievement_percent=(
                    round(min(spending / target, 1.0) * 100, 1) if target else None
                ),
            )
        )

    return result
