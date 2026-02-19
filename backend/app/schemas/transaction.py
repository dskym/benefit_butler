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


class TransactionUpdate(BaseModel):
    type: str | None = None
    amount: Decimal | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    transacted_at: datetime | None = None


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

    model_config = {"from_attributes": True}
