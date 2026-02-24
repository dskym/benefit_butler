import uuid
from datetime import date, datetime

from pydantic import BaseModel


class UserCardCreate(BaseModel):
    type: str  # "credit_card" | "debit_card"
    name: str
    monthly_target: int | None = None
    billing_day: int | None = None  # 1~28


class UserCardUpdate(BaseModel):
    monthly_target: int | None = None
    billing_day: int | None = None  # 1~28


class UserCardResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    name: str
    monthly_target: int | None
    billing_day: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CardPerformanceItem(BaseModel):
    card_id: str
    card_name: str
    card_type: str
    monthly_target: int | None
    billing_day: int | None
    period_start: date
    period_end: date
    current_spending: int
    remaining: int | None          # None if monthly_target is None
    achievement_percent: float | None
