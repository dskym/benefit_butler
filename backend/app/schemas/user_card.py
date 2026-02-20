import uuid
from datetime import datetime

from pydantic import BaseModel


class UserCardCreate(BaseModel):
    type: str  # "credit_card" | "debit_card"
    name: str


class UserCardUpdate(BaseModel):
    monthly_target: int | None = None


class UserCardResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    name: str
    monthly_target: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
