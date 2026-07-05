"""가맹점명 정규화 및 해석(resolve).

해석 우선순위:
  1. 로컬 별칭 사전 정확 일치 (confidence 1.0)
  2. 로컬 별칭 부분 일치 — 최장 별칭 우선 (confidence 0.7, "스타벅스 강남점" → 스타벅스)
  3. Naver Local API 폴백 — 카테고리만 획득 (confidence 0.5)
  4. 실패 (confidence 0.0)
"""
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import func, literal, or_, select
from sqlalchemy.orm import Session

from app.models.merchant import Merchant, MerchantAlias
from app.services.merchant_lookup import lookup_merchant_category

# 법인 표기·지점 접미어 등 매칭에 방해되는 토큰
_CORP_TOKENS = re.compile(r"\(주\)|㈜|주식회사")
# 정규화 후 남길 문자: 한글/영문/숫자만
_NON_ALNUM = re.compile(r"[^0-9a-z가-힣]+")
# 끝의 지점 접미어: "스타벅스 강남점" → "스타벅스강남" 제거는 과하므로 "…점"만 제거
_BRANCH_SUFFIX = re.compile(r"(역|점|지점|본점)$")


def normalize_merchant_name(raw: str) -> str:
    """가맹점명을 매칭용 표준형으로 변환.

    소문자화 → 법인 표기 제거 → 특수문자/공백 제거 → 말단 지점 접미어 제거.
    예: "[신한카드] (주)스타벅스 강남점" → "스타벅스강남"
    """
    s = raw.lower()
    s = re.sub(r"\[.*?\]", "", s)  # SMS 카드 접두어 "[국민카드]" 등
    s = _CORP_TOKENS.sub("", s)
    s = _NON_ALNUM.sub("", s)
    s = _BRANCH_SUFFIX.sub("", s)
    return s


@dataclass
class ResolvedMerchant:
    merchant_id: uuid.UUID | None
    merchant_name: str | None
    category: str | None
    source: str  # "alias" | "partial" | "naver" | "none"
    confidence: float


_MISS = ResolvedMerchant(merchant_id=None, merchant_name=None, category=None, source="none", confidence=0.0)


def resolve_merchant_local(db: Session, query: str) -> ResolvedMerchant | None:
    """로컬 가맹점 사전에서 해석. 미스면 None."""
    q = normalize_merchant_name(query)
    if len(q) < 2:
        return None

    base = select(Merchant, MerchantAlias.alias_normalized).join(
        MerchantAlias, MerchantAlias.merchant_id == Merchant.id
    )

    # 1) 정확 일치
    row = db.execute(base.where(MerchantAlias.alias_normalized == q)).first()
    if row:
        merchant = row[0]
        return ResolvedMerchant(merchant.id, merchant.name, merchant.category, "alias", 1.0)

    # 2) 부분 일치: 별칭⊂질의("스타벅스강남" ⊃ "스타벅스") 또는 질의⊂별칭.
    #    최장 별칭 우선 — "이마트24강남" 질의가 "이마트"보다 "이마트24"에 붙도록.
    row = db.execute(
        base.where(
            func.length(MerchantAlias.alias_normalized) >= 2,
            or_(
                literal(q).like(func.concat("%", MerchantAlias.alias_normalized, "%")),
                MerchantAlias.alias_normalized.like(f"%{q}%"),
            ),
        )
        .order_by(func.length(MerchantAlias.alias_normalized).desc())
        .limit(1)
    ).first()
    if row:
        merchant = row[0]
        return ResolvedMerchant(merchant.id, merchant.name, merchant.category, "partial", 0.7)

    return None


async def resolve_merchant(db: Session, query: str) -> ResolvedMerchant:
    """로컬 사전 우선, 미스 시 Naver Local API로 카테고리만 보조 해석."""
    local = resolve_merchant_local(db, query)
    if local is not None:
        return local

    naver = await lookup_merchant_category(query)
    if naver.get("category"):
        return ResolvedMerchant(
            merchant_id=None,
            merchant_name=None,
            category=naver["category"],
            source="naver",
            confidence=0.5,
        )
    return _MISS


def get_or_create_merchants(db: Session, names: list[str], default_category: str) -> list[Merchant]:
    """혜택 CRUD가 참조하는 가맹점명 목록을 Merchant 행으로 변환.

    별칭 정확 일치 → 대표명 일치 → 신규 생성(+별칭 등록) 순.
    """
    merchants: list[Merchant] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        normalized = normalize_merchant_name(name)
        alias_row = db.execute(
            select(Merchant)
            .join(MerchantAlias, MerchantAlias.merchant_id == Merchant.id)
            .where(MerchantAlias.alias_normalized == normalized)
        ).first()
        if alias_row:
            merchants.append(alias_row[0])
            continue
        existing = db.scalar(select(Merchant).where(Merchant.name == name))
        if existing:
            merchants.append(existing)
            continue
        merchant = Merchant(name=name, category=default_category)
        db.add(merchant)
        db.flush()
        if normalized:
            db.add(MerchantAlias(merchant_id=merchant.id, alias_normalized=normalized))
        merchants.append(merchant)
    # 중복 제거 (이름이 같은 항목이 두 번 온 경우)
    unique: dict[uuid.UUID, Merchant] = {m.id: m for m in merchants}
    return list(unique.values())
