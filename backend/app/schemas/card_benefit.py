import uuid
from datetime import datetime

from pydantic import BaseModel


class UserCardBenefitCreate(BaseModel):
    category: str
    benefit_type: str
    rate: float | None = None
    flat_amount: int | None = None
    monthly_cap: int | None = None
    min_amount: int | None = None


class UserCardBenefitUpdate(BaseModel):
    category: str | None = None
    benefit_type: str | None = None
    rate: float | None = None
    flat_amount: int | None = None
    monthly_cap: int | None = None
    min_amount: int | None = None


class UserCardBenefitResponse(BaseModel):
    id: uuid.UUID
    user_card_id: uuid.UUID
    category: str
    benefit_type: str
    rate: float | None
    flat_amount: int | None
    monthly_cap: int | None
    min_amount: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendRequest(BaseModel):
    merchant_name: str
    amount: int | None = None
    category: str | None = None


class RecommendResult(BaseModel):
    card_id: str
    card_name: str
    benefit_type: str
    benefit_description: str
    effective_value: int
    is_near_target: bool
