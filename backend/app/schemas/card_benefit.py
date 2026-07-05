import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.constants import BENEFIT_CATEGORIES


class _BenefitTargetMixin(BaseModel):
    """target 필드 정규화/검증 공통 로직.

    구 클라이언트 호환: category="전체"는 target_type="all"로 변환한다.
    """

    @model_validator(mode="after")
    def _normalize_and_validate(self):
        if self.category == "전체":
            self.target_type = "all"
            self.category = None
        if self.target_type == "all":
            self.category = None
            self.merchant_names = []
        elif self.target_type == "category":
            if not self.category:
                raise ValueError("target_type='category'는 category가 필요합니다")
            if self.category not in BENEFIT_CATEGORIES:
                raise ValueError(f"알 수 없는 카테고리: {self.category}")
            self.merchant_names = []
        elif self.target_type == "merchant":
            if not self.merchant_names:
                raise ValueError("target_type='merchant'는 merchant_names가 필요합니다")
        else:
            raise ValueError(f"알 수 없는 target_type: {self.target_type}")
        return self


class UserCardBenefitCreate(_BenefitTargetMixin):
    title: str | None = None
    target_type: str = "category"
    category: str | None = None
    merchant_names: list[str] = []
    benefit_type: str
    rate: float | None = None
    flat_amount: int | None = None
    monthly_cap: int | None = None
    min_amount: int | None = None
    requires_performance: bool = False


class UserCardBenefitUpdate(BaseModel):
    title: str | None = None
    target_type: str | None = None
    category: str | None = None
    merchant_names: list[str] | None = None
    benefit_type: str | None = None
    rate: float | None = None
    flat_amount: int | None = None
    monthly_cap: int | None = None
    min_amount: int | None = None
    requires_performance: bool | None = None


class UserCardBenefitResponse(BaseModel):
    id: uuid.UUID
    user_card_id: uuid.UUID
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
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Recommend ─────────────────────────────────────────────────────────────────


class RecommendRequest(BaseModel):
    merchant_name: str | None = None
    merchant_id: uuid.UUID | None = None  # 프론트가 lookup으로 이미 해석한 경우
    amount: int = Field(gt=0)
    category: str | None = None  # 수동 오버라이드 (resolve 결과보다 우선)

    @model_validator(mode="after")
    def _legacy_all_category(self):
        # 구 클라이언트가 보내는 "전체"는 오버라이드 없음으로 취급
        if self.category == "전체":
            self.category = None
        return self


class ResolvedMerchantInfo(BaseModel):
    merchant_id: uuid.UUID | None
    merchant_name: str | None
    category: str | None
    source: str  # "alias" | "partial" | "naver" | "none"
    confidence: float


class RecommendItem(BaseModel):
    card_id: str
    card_name: str
    benefit_title: str | None
    benefit_type: str
    benefit_description: str
    matched_by: Literal["merchant", "category", "all"]
    effective_value: int
    performance_required: bool
    performance_met: bool | None  # None = 실적 목표 미설정
    is_near_target: bool


class RecommendResponse(BaseModel):
    resolved: ResolvedMerchantInfo | None
    results: list[RecommendItem]
