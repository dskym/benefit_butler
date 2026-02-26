"""Card recommendation algorithm.

Score = effective_benefit_value + performance_bonus

effective_benefit_value:
  cashback/points: int(amount * rate / 100)
  discount/free:   flat_amount
  → min(above, monthly_cap - used_this_month) if monthly_cap set

performance_bonus:
  remaining / monthly_target < 20%  →  +500 (sort weight)

Benefit priority: user_card_benefits first → catalog_benefits fallback.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.card_benefit import CatalogBenefit, UserCardBenefit
from app.models.user_card import UserCard
from app.schemas.card_benefit import RecommendResult
from app.services.user_card import get_performance_period


# ── Pure calculation helpers ──────────────────────────────────────────────────


def _calc_raw_benefit(benefit_type: str, rate: float | None, flat_amount: int | None, amount: int) -> int:
    if benefit_type in ("cashback", "points"):
        return int(amount * (rate or 0) / 100)
    if benefit_type in ("discount", "free"):
        return flat_amount or 0
    return 0


def _calc_effective_benefit(
    benefit_type: str,
    rate: float | None,
    flat_amount: int | None,
    monthly_cap: int | None,
    amount: int,
    used_this_month: int,
) -> int:
    raw = _calc_raw_benefit(benefit_type, rate, flat_amount, amount)
    if monthly_cap is not None:
        remaining_cap = max(0, monthly_cap - used_this_month)
        raw = min(raw, remaining_cap)
    return raw


def _calc_performance_bonus(remaining: int | None, monthly_target: int | None) -> int:
    if remaining is not None and monthly_target and monthly_target > 0:
        if remaining / monthly_target < 0.2:
            return 500
    return 0


def _benefit_description(
    benefit_type: str, rate: float | None, flat_amount: int | None, monthly_cap: int | None, category: str
) -> str:
    parts: list[str] = []
    if benefit_type == "cashback":
        parts.append(f"{category} {rate}% 캐시백")
    elif benefit_type == "points":
        parts.append(f"{category} {rate}% 포인트 적립")
    elif benefit_type == "discount":
        parts.append(f"{category} {flat_amount:,}원 할인")
    elif benefit_type == "free":
        parts.append(f"{category} 무료 제공")
    if monthly_cap:
        parts.append(f"월 최대 {monthly_cap:,}원")
    return " / ".join(parts)


# ── Used-this-month for a card-benefit calculation ────────────────────────────


def _get_used_benefit_amount(
    db: Session,
    user_card_id: uuid.UUID,
    billing_day: int | None,
    today: date,
) -> int:
    """Approximate 'used benefit amount' this period.

    We proxy used_this_month as current_spending for simplicity — the benefit
    engine uses this only to cap against monthly_cap.  A more precise
    implementation would track actual benefit redemptions; this approximation
    is sufficient for sorting purposes.
    """
    from app.models.transaction import Transaction  # avoid circular import

    start, end = get_performance_period(billing_day, today)
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(
        (end + timedelta(days=1)).year,
        (end + timedelta(days=1)).month,
        (end + timedelta(days=1)).day,
        tzinfo=timezone.utc,
    )
    raw = db.scalar(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_card_id == user_card_id,
            Transaction.type == "expense",
            Transaction.transacted_at >= start_dt,
            Transaction.transacted_at < end_dt,
        )
    )
    return int(raw or 0)


# ── Main recommend function ───────────────────────────────────────────────────


def recommend_cards(
    db: Session,
    user_id: uuid.UUID,
    category: str | None,
    amount: int,
) -> list[RecommendResult]:
    """Return cards sorted by expected benefit score, highest first.

    category=None  → match only "전체" benefits
    category=<str> → match exact category OR "전체"
    """
    today = date.today()

    cards: list[UserCard] = list(
        db.scalars(
            select(UserCard).where(UserCard.user_id == user_id)
        ).all()
    )

    results: list[tuple[int, RecommendResult]] = []

    for card in cards:
        # 1. Determine benefits to use (user override first, then catalog fallback)
        user_benefits: list[UserCardBenefit] = list(
            db.scalars(
                select(UserCardBenefit).where(UserCardBenefit.user_card_id == card.id)
            ).all()
        )

        if user_benefits:
            # Use only user-defined benefits
            candidate_benefits = [
                (b.category, b.benefit_type, b.rate, b.flat_amount, b.monthly_cap, b.min_amount)
                for b in user_benefits
            ]
        elif card.catalog_id:
            # Fallback to catalog benefits
            catalog_benefits: list[CatalogBenefit] = list(
                db.scalars(
                    select(CatalogBenefit).where(CatalogBenefit.catalog_id == card.catalog_id)
                ).all()
            )
            candidate_benefits = [
                (b.category, b.benefit_type, b.rate, b.flat_amount, b.monthly_cap, b.min_amount)
                for b in catalog_benefits
            ]
        else:
            candidate_benefits = []

        # 2. Filter matching benefits
        matching = [
            b for b in candidate_benefits
            if b[0] == "전체" or (category and b[0] == category)
        ]

        if not matching:
            continue

        # 3. Pick best matching benefit for this card
        used = _get_used_benefit_amount(db, card.id, card.billing_day, today)
        best_value = 0
        best_benefit = None
        for b in matching:
            b_cat, b_type, b_rate, b_flat, b_cap, b_min = b
            # Check min_amount condition
            if b_min and amount < b_min:
                continue
            value = _calc_effective_benefit(b_type, b_rate, b_flat, b_cap, amount, used)
            if value > best_value:
                best_value = value
                best_benefit = b

        if best_benefit is None:
            # All benefits had min_amount > amount; still include with value=0
            # only if there's at least one benefit (skip card entirely if no match)
            continue

        b_cat, b_type, b_rate, b_flat, b_cap, b_min = best_benefit

        # 4. Performance bonus
        perf_remaining: int | None = None
        if card.monthly_target is not None:
            perf_remaining = max(0, card.monthly_target - used)
        bonus = _calc_performance_bonus(perf_remaining, card.monthly_target)
        score = best_value + bonus

        description = _benefit_description(b_type, b_rate, b_flat, b_cap, b_cat)
        is_near = bonus > 0

        results.append((
            score,
            RecommendResult(
                card_id=str(card.id),
                card_name=card.name,
                benefit_type=b_type,
                benefit_description=description,
                effective_value=best_value,
                is_near_target=is_near,
            )
        ))

    results.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in results]
