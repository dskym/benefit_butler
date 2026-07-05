import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CatalogBenefit(Base):
    __tablename__ = "catalog_benefits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("card_catalog.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 표시명 (예: "커피전문점 10% 할인")
    target_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'category'")
    )  # "all" | "category" | "merchant"
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # target_type="category"일 때만
    benefit_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "cashback" | "points" | "discount" | "free"
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)       # 3.0 = 3%
    flat_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)  # fixed KRW
    monthly_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)  # max monthly benefit KRW
    min_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)   # minimum payment amount
    requires_performance: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )  # 전월 실적(monthly_target) 충족 시에만 적용
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    merchants = relationship("Merchant", secondary="catalog_benefit_merchants", lazy="selectin")

    @property
    def merchant_names(self) -> list[str]:
        return [m.name for m in self.merchants]


class UserCardBenefit(Base):
    __tablename__ = "user_card_benefits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_cards.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_type: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'category'")
    )
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    benefit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    flat_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_performance: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    merchants = relationship("Merchant", secondary="user_card_benefit_merchants", lazy="selectin")

    @property
    def merchant_names(self) -> list[str]:
        return [m.name for m in self.merchants]


class CatalogBenefitMerchant(Base):
    __tablename__ = "catalog_benefit_merchants"

    benefit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_benefits.id", ondelete="CASCADE"), primary_key=True
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), primary_key=True
    )


class UserCardBenefitMerchant(Base):
    __tablename__ = "user_card_benefit_merchants"

    benefit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_card_benefits.id", ondelete="CASCADE"), primary_key=True
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), primary_key=True
    )
