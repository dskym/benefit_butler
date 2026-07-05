import uuid
from datetime import datetime

from pydantic import BaseModel


class CatalogBenefitResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    target_type: str  # "all" | "category" | "merchant"
    category: str | None
    merchant_names: list[str]
    benefit_type: str
    rate: float | None
    flat_amount: int | None
    monthly_cap: int | None
    min_amount: int | None
    requires_performance: bool

    model_config = {"from_attributes": True}


class CardCatalogResponse(BaseModel):
    id: uuid.UUID
    name: str
    issuer: str
    card_type: str
    image_url: str | None
    is_active: bool
    created_at: datetime
    benefits: list[CatalogBenefitResponse]

    model_config = {"from_attributes": True}
