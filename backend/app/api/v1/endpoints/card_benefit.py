import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.card_benefit import UserCardBenefit, UserCardBenefitMerchant
from app.models.user_card import UserCard
from app.schemas.card_benefit import UserCardBenefitCreate, UserCardBenefitResponse, UserCardBenefitUpdate
from app.services.merchant_resolver import get_or_create_merchants

router = APIRouter(prefix="/cards", tags=["card-benefits"])


def _get_owned_card(db: Session, user_id: uuid.UUID, card_id: uuid.UUID) -> UserCard:
    card = db.scalar(select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id))
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _set_merchant_targets(db: Session, benefit: UserCardBenefit, merchant_names: list[str], category: str | None) -> None:
    """혜택의 가맹점 타겟을 교체. 미등록 가맹점명은 자동 생성한다."""
    db.execute(delete(UserCardBenefitMerchant).where(UserCardBenefitMerchant.benefit_id == benefit.id))
    merchants = get_or_create_merchants(db, merchant_names, default_category=category or "쇼핑")
    for merchant in merchants:
        db.add(UserCardBenefitMerchant(benefit_id=benefit.id, merchant_id=merchant.id))


@router.get("/{card_id}/benefits", response_model=list[UserCardBenefitResponse])
def list_benefits(
    card_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_card(db, current_user.id, card_id)
    return list(
        db.scalars(
            select(UserCardBenefit)
            .where(UserCardBenefit.user_card_id == card_id)
            .order_by(UserCardBenefit.created_at.asc())
        ).all()
    )


@router.post("/{card_id}/benefits", response_model=UserCardBenefitResponse, status_code=status.HTTP_201_CREATED)
def create_benefit(
    card_id: uuid.UUID,
    data: UserCardBenefitCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_card(db, current_user.id, card_id)
    benefit = UserCardBenefit(
        user_card_id=card_id,
        title=data.title,
        target_type=data.target_type,
        category=data.category,
        benefit_type=data.benefit_type,
        rate=data.rate,
        flat_amount=data.flat_amount,
        monthly_cap=data.monthly_cap,
        min_amount=data.min_amount,
        requires_performance=data.requires_performance,
    )
    db.add(benefit)
    db.flush()
    if data.target_type == "merchant":
        _set_merchant_targets(db, benefit, data.merchant_names, data.category)
    db.commit()
    db.refresh(benefit)
    return benefit


@router.patch("/{card_id}/benefits/{benefit_id}", response_model=UserCardBenefitResponse)
def update_benefit(
    card_id: uuid.UUID,
    benefit_id: uuid.UUID,
    data: UserCardBenefitUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_card(db, current_user.id, card_id)
    benefit = db.scalar(
        select(UserCardBenefit).where(
            UserCardBenefit.id == benefit_id,
            UserCardBenefit.user_card_id == card_id,
        )
    )
    if benefit is None:
        raise HTTPException(status_code=404, detail="Benefit not found")

    updates = data.model_dump(exclude_unset=True)
    merchant_names = updates.pop("merchant_names", None)

    # 구 클라이언트 호환: category="전체" → target_type="all"
    if updates.get("category") == "전체":
        updates["category"] = None
        updates["target_type"] = "all"
    elif "category" in updates and updates["category"] and "target_type" not in updates:
        updates["target_type"] = "category"

    for field, value in updates.items():
        setattr(benefit, field, value)

    # 변경 결과 정합성 검증
    if benefit.target_type == "category" and not benefit.category:
        raise HTTPException(status_code=422, detail="target_type='category'는 category가 필요합니다")
    if benefit.target_type == "merchant":
        if merchant_names is not None:
            _set_merchant_targets(db, benefit, merchant_names, benefit.category)
            db.flush()
        db.expire(benefit, ["merchants"])
        if not benefit.merchants:
            raise HTTPException(status_code=422, detail="target_type='merchant'는 merchant_names가 필요합니다")
    else:
        benefit.category = benefit.category if benefit.target_type == "category" else None
        db.execute(delete(UserCardBenefitMerchant).where(UserCardBenefitMerchant.benefit_id == benefit.id))

    db.commit()
    db.refresh(benefit)
    return benefit


@router.delete("/{card_id}/benefits/{benefit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_benefit(
    card_id: uuid.UUID,
    benefit_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_card(db, current_user.id, card_id)
    benefit = db.scalar(
        select(UserCardBenefit).where(
            UserCardBenefit.id == benefit_id,
            UserCardBenefit.user_card_id == card_id,
        )
    )
    if benefit is None:
        raise HTTPException(status_code=404, detail="Benefit not found")
    db.delete(benefit)
    db.commit()
