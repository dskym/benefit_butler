import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # 대표명 (예: "스타벅스")
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # BENEFIT_CATEGORIES 중 하나
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False
    )
    # normalize_merchant_name()을 거친 형태로 저장 (소문자, 공백/특수문자 제거)
    alias_normalized: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
