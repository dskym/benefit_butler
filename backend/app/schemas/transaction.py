# backend/app/schemas/transaction.py
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    type: str  # income/expense/transfer
    amount: Decimal
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime
    payment_type: str | None = None  # "cash" | "credit_card" | "debit_card" | "bank"
    user_card_id: uuid.UUID | None = None


class TransactionUpdate(BaseModel):
    type: str | None = None
    amount: Decimal | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime | None = None
    payment_type: str | None = None
    user_card_id: uuid.UUID | None = None


class FavoritePatch(BaseModel):
    is_favorite: bool


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID | None
    type: str
    amount: Decimal
    description: str | None
    transacted_at: datetime
    created_at: datetime
    updated_at: datetime
    payment_type: str | None
    user_card_id: uuid.UUID | None
    is_favorite: bool

    model_config = {"from_attributes": True}
