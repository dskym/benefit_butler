from fastapi import APIRouter, Query

from app.services.merchant_lookup import INTERNAL_CATEGORIES, lookup_merchant_category

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/lookup")
async def lookup_merchant(
    q: str = Query(..., description="가맹점명"),
):
    """Lookup merchant business category.

    Returns { category, raw_category, available_categories }.
    If Naver API is not configured, category=null and the frontend
    should show a manual category picker.
    """
    result = await lookup_merchant_category(q)
    return {
        **result,
        "available_categories": INTERNAL_CATEGORIES,
    }
