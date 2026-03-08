# backend/app/api/v1/router.py
from fastapi import APIRouter

from app.api.v1.endpoints import auth, categories, transactions, cards, card_catalog, card_benefit, merchant

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(cards.router)
api_router.include_router(card_catalog.router)
api_router.include_router(card_benefit.router)
api_router.include_router(merchant.router)
