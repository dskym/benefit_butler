"""카드 추천 엔진.

사용자 보유 카드의 user_card_benefits만 평가한다 (카탈로그 혜택은 카드 등록 시
user_card_benefits로 스냅샷 복사되므로 여기서 fallback하지 않는다).

혜택 매칭 계층(tier):
  2 — merchant 타겟에 해당 가맹점 포함
  1 — category 타겟이 요청 카테고리와 일치
  0 — target_type = "all"
  None — 불일치(제외)

혜택별 조건:
  - min_amount > 결제금액 → 제외
  - requires_performance=True인데 전월(직전 실적기간) 지출 < monthly_target → 제외
    (monthly_target 미설정 카드는 충족으로 간주)

혜택 가치:
  cashback/points → int(amount * rate / 100), discount/free → flat_amount,
  monthly_cap이 있으면 min(값, monthly_cap).

카드 내 최적 혜택은 (가치 desc, tier desc)로 선택 — 동가치면 가맹점 > 카테고리 > 전체.
전체 결과는 effective_value desc로 정렬. 실적 임박(is_near_target)은 정보 플래그다.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.card_benefit import UserCardBenefit
from app.models.user_card import UserCard
from app.schemas.card_benefit import RecommendItem
from app.services.user_card import get_performance_period


# ── Pure calculation helpers ──────────────────────────────────────────────────


def _calc_effective_benefit(benefit: UserCardBenefit, amount: int) -> int:
    if benefit.benefit_type in ("cashback", "points"):
        raw = int(amount * (benefit.rate or 0) / 100)
    elif benefit.benefit_type in ("discount", "free"):
        raw = benefit.flat_amount or 0
    else:
        raw = 0
    if benefit.monthly_cap is not None:
        raw = min(raw, benefit.monthly_cap)
    return raw


def _match_tier(
    benefit: UserCardBenefit,
    merchant_id: uuid.UUID | None,
    category: str | None,
) -> int | None:
    if benefit.target_type == "merchant":
        if merchant_id is not None and any(m.id == merchant_id for m in benefit.merchants):
            return 2
        return None
    if benefit.target_type == "category":
        if category is not None and benefit.category == category:
            return 1
        return None
    if benefit.target_type == "all":
        return 0
    return None


_MATCHED_BY = {2: "merchant", 1: "category", 0: "all"}


def _benefit_description(benefit: UserCardBenefit) -> str:
    if benefit.target_type == "merchant":
        names = benefit.merchant_names
        label = "/".join(names[:2]) + (f" 외 {len(names) - 2}곳" if len(names) > 2 else "")
    elif benefit.target_type == "category":
        label = benefit.category or ""
    else:
        label = "전체"

    if benefit.benefit_type == "cashback":
        body = f"{label} {benefit.rate}% 캐시백"
    elif benefit.benefit_type == "points":
        body = f"{label} {benefit.rate}% 포인트 적립"
    elif benefit.benefit_type == "discount":
        body = f"{label} {benefit.flat_amount:,}원 할인"
    elif benefit.benefit_type == "free":
        body = f"{label} 무료 제공"
    else:
        body = label

    if benefit.monthly_cap:
        body += f" / 월 최대 {benefit.monthly_cap:,}원"
    return body


# ── Spending / performance helpers ────────────────────────────────────────────


def _sum_expense(db: Session, user_card_id: uuid.UUID, start: date, end: date) -> int:
    from app.models.transaction import Transaction  # avoid circular import

    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_next = end + timedelta(days=1)
    end_dt = datetime(end_next.year, end_next.month, end_next.day, tzinfo=timezone.utc)
    raw = db.scalar(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_card_id == user_card_id,
            Transaction.type == "expense",
            Transaction.transacted_at >= start_dt,
            Transaction.transacted_at < end_dt,
        )
    )
    return int(raw or 0)


def _performance_met(db: Session, card: UserCard, today: date) -> bool | None:
    """전월(직전 실적기간) 지출이 monthly_target 이상인지. 목표 미설정이면 None(충족 간주)."""
    if not card.monthly_target:
        return None
    current_start, _ = get_performance_period(card.billing_day, today)
    prev_start, prev_end = get_performance_period(card.billing_day, current_start - timedelta(days=1))
    return _sum_expense(db, card.id, prev_start, prev_end) >= card.monthly_target


def _is_near_target(db: Session, card: UserCard, today: date) -> bool:
    """이번 실적기간 잔여 실적이 목표의 20% 미만이면 True (정보 플래그)."""
    if not card.monthly_target:
        return False
    start, end = get_performance_period(card.billing_day, today)
    spending = _sum_expense(db, card.id, start, end)
    remaining = max(0, card.monthly_target - spending)
    return remaining / card.monthly_target < 0.2


# ── Main recommend function ───────────────────────────────────────────────────


def recommend_cards(
    db: Session,
    user_id: uuid.UUID,
    *,
    amount: int,
    merchant_id: uuid.UUID | None = None,
    category: str | None = None,
) -> list[RecommendItem]:
    """보유 카드별 최적 혜택을 평가해 기대 혜택 큰 순으로 반환."""
    today = date.today()
    cards = list(db.scalars(select(UserCard).where(UserCard.user_id == user_id)).all())

    items: list[RecommendItem] = []
    for card in cards:
        benefits = list(
            db.scalars(select(UserCardBenefit).where(UserCardBenefit.user_card_id == card.id)).all()
        )
        if not benefits:
            continue

        performance_met = _performance_met(db, card, today)

        best: tuple[int, int, UserCardBenefit] | None = None  # (value, tier, benefit)
        for benefit in benefits:
            tier = _match_tier(benefit, merchant_id, category)
            if tier is None:
                continue
            if benefit.min_amount and amount < benefit.min_amount:
                continue
            if benefit.requires_performance and performance_met is False:
                continue
            value = _calc_effective_benefit(benefit, amount)
            if best is None or (value, tier) > (best[0], best[1]):
                best = (value, tier, benefit)

        if best is None:
            continue

        value, tier, benefit = best
        items.append(
            RecommendItem(
                card_id=str(card.id),
                card_name=card.name,
                benefit_title=benefit.title,
                benefit_type=benefit.benefit_type,
                benefit_description=_benefit_description(benefit),
                matched_by=_MATCHED_BY[tier],
                effective_value=value,
                performance_required=benefit.requires_performance,
                performance_met=performance_met,
                is_near_target=_is_near_target(db, card, today),
            )
        )

    items.sort(key=lambda item: item.effective_value, reverse=True)
    return items
