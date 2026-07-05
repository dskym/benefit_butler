from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.merchant_lookup import INTERNAL_CATEGORIES
from app.services.merchant_resolver import resolve_merchant

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/lookup")
async def lookup_merchant(
    q: str = Query(..., description="가맹점명"),
    db: Session = Depends(get_db),
):
    """가맹점명 해석: 로컬 사전(별칭) 우선, 미스 시 Naver Local API 보조.

    Returns { merchant_id, merchant_name, category, source, confidence, available_categories }.
    source: "alias"(정확) | "partial"(부분) | "naver" | "none".
    category=null이면 프론트는 수동 카테고리 선택을 보여준다.
    """
    result = await resolve_merchant(db, q)
    return {
        "merchant_id": str(result.merchant_id) if result.merchant_id else None,
        "merchant_name": result.merchant_name,
        "category": result.category,
        "source": result.source,
        "confidence": result.confidence,
        "available_categories": INTERNAL_CATEGORIES,
    }
