import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.merchant import Merchant
from app.schemas.card_benefit import RecommendRequest, RecommendResponse, ResolvedMerchantInfo
from app.schemas.user_card import CardPerformanceItem, UserCardCreate, UserCardResponse, UserCardUpdate
from app.services.merchant_resolver import resolve_merchant
import app.services.user_card as card_service
import app.services.card_recommendation as recommend_service

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/performance", response_model=list[CardPerformanceItem])
def get_performance(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_service.get_cards_performance(db, current_user.id)


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


@router.patch("/{card_id}", response_model=UserCardResponse)
def update_card(
    card_id: uuid.UUID,
    data: UserCardUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_service.update_card(db, current_user.id, card_id, data)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card_service.delete_card(db, current_user.id, card_id)


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_cards(
    data: RecommendRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved: ResolvedMerchantInfo | None = None
    merchant_id = data.merchant_id
    category = data.category

    if merchant_id is not None:
        merchant = db.get(Merchant, merchant_id)
        if merchant is not None:
            resolved = ResolvedMerchantInfo(
                merchant_id=merchant.id,
                merchant_name=merchant.name,
                category=merchant.category,
                source="alias",
                confidence=1.0,
            )
            if category is None:
                category = merchant.category
    elif data.merchant_name:
        r = await resolve_merchant(db, data.merchant_name)
        resolved = ResolvedMerchantInfo(
            merchant_id=r.merchant_id,
            merchant_name=r.merchant_name,
            category=r.category,
            source=r.source,
            confidence=r.confidence,
        )
        merchant_id = r.merchant_id
        if category is None:
            category = r.category

    results = recommend_service.recommend_cards(
        db, current_user.id, amount=data.amount, merchant_id=merchant_id, category=category
    )
    return RecommendResponse(resolved=resolved, results=results)
