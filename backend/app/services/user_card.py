import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user_card import UserCard
from app.schemas.user_card import UserCardCreate


def list_cards(db: Session, user_id: uuid.UUID) -> list[UserCard]:
    return list(
        db.scalars(
            select(UserCard)
            .where(UserCard.user_id == user_id)
            .order_by(UserCard.created_at.asc())
        ).all()
    )


def create_card(db: Session, user_id: uuid.UUID, data: UserCardCreate) -> UserCard:
    card = UserCard(user_id=user_id, type=data.type, name=data.name)
    db.add(card)
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
