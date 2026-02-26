import uuid
from datetime import datetime

from pydantic import BaseModel


class CardCatalogResponse(BaseModel):
    id: uuid.UUID
    name: str
    issuer: str
    card_type: str
    image_url: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
