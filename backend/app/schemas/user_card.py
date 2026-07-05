import uuid
from datetime import date, datetime

from pydantic import BaseModel


class UserCardCreate(BaseModel):
    type: str  # "credit_card" | "debit_card"
    name: str
    monthly_target: int | None = None
    billing_day: int | None = None  # 1~28
    catalog_id: uuid.UUID | None = None  # 지정 시 카탈로그 혜택을 스냅샷 복사


class UserCardUpdate(BaseModel):
    monthly_target: int | None = None
    billing_day: int | None = None  # 1~28
    catalog_id: uuid.UUID | None = None  # 변경 시 기존 혜택 삭제 후 재복사 (파괴적)


class UserCardResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    name: str
    monthly_target: int | None
    billing_day: int | None
    catalog_id: uuid.UUID | None
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
