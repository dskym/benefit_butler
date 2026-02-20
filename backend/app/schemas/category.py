# backend/app/schemas/category.py
import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    type: str  # income/expense/transfer
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    color: str | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: str
    color: str | None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
