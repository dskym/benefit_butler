import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.schemas.user_card import UserCardCreate, UserCardResponse
import app.services.user_card as card_service

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/", response_model=list[UserCardResponse])
def list_cards(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_service.list_cards(db, current_user.id)


@router.post("/", response_model=UserCardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    data: UserCardCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_service.create_card(db, current_user.id, data)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card_service.delete_card(db, current_user.id, card_id)
