import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.card_benefit import UserCardBenefit
from app.models.user_card import UserCard
from app.schemas.card_benefit import UserCardBenefitCreate, UserCardBenefitResponse, UserCardBenefitUpdate

router = APIRouter(prefix="/cards", tags=["card-benefits"])


def _get_owned_card(db: Session, user_id: uuid.UUID, card_id: uuid.UUID) -> UserCard:
    card = db.scalar(select(UserCard).where(UserCard.id == card_id, UserCard.user_id == user_id))
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


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
        category=data.category,
        benefit_type=data.benefit_type,
        rate=data.rate,
        flat_amount=data.flat_amount,
        monthly_cap=data.monthly_cap,
        min_amount=data.min_amount,
    )
    db.add(benefit)
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
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(benefit, field, value)
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
