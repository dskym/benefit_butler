import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CatalogBenefit(Base):
    __tablename__ = "catalog_benefits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("card_catalog.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)   # "식비" | "교통" | "전체" etc.
    benefit_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "cashback" | "points" | "discount" | "free"
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)       # 3.0 = 3%
    flat_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)  # fixed KRW
    monthly_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)  # max monthly benefit KRW
    min_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)   # minimum payment amount
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UserCardBenefit(Base):
    __tablename__ = "user_card_benefits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_cards.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    benefit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    flat_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
