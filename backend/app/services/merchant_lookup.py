"""Merchant category lookup — pluggable backend.

If NAVER_CLIENT_ID and NAVER_CLIENT_SECRET environment variables are set,
queries the Naver Local Search API to detect the business category of a
merchant.  Otherwise returns None so the frontend can show a manual picker.
"""
import os

import httpx

# Internal category list
INTERNAL_CATEGORIES = ["식비", "교통", "쇼핑", "의료", "여행", "통신", "주유", "문화/여가", "전체"]

# Naver category keyword → internal category mapping
_NAVER_CATEGORY_MAP: dict[str, str] = {
    "음식점": "식비",
    "카페": "식비",
    "베이커리": "식비",
    "패스트푸드": "식비",
    "술집": "식비",
    "지하철": "교통",
    "버스": "교통",
    "택시": "교통",
    "주차": "교통",
    "항공": "여행",
    "숙박": "여행",
    "여행": "여행",
    "면세": "여행",
    "쇼핑": "쇼핑",
    "마트": "쇼핑",
    "편의점": "쇼핑",
    "의류": "쇼핑",
    "가전": "쇼핑",
    "서적": "쇼핑",
    "병원": "의료",
    "약국": "의료",
    "의원": "의료",
    "치과": "의료",
    "한의원": "의료",
    "통신": "통신",
    "핸드폰": "통신",
    "주유소": "주유",
    "영화": "문화/여가",
    "공연": "문화/여가",
    "스포츠": "문화/여가",
    "게임": "문화/여가",
    "노래": "문화/여가",
}


def _map_naver_category(raw_category: str) -> str | None:
    """Map Naver's hierarchical category string to an internal category."""
    for keyword, internal in _NAVER_CATEGORY_MAP.items():
        if keyword in raw_category:
            return internal
    return None


async def lookup_merchant_category(merchant_name: str) -> dict[str, str | None]:
    """Return {'category': <internal_category>, 'raw_category': <naver_raw>}.

    If the Naver API is not configured or lookup fails, returns {'category': None, 'raw_category': None}.
    """
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        return {"category": None, "raw_category": None}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://openapi.naver.com/v1/search/local.json",
                params={"query": merchant_name, "display": 1},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
            )
            response.raise_for_status()
            data = response.json()
            items = data.get("items", [])
            if not items:
                return {"category": None, "raw_category": None}
            raw_category: str = items[0].get("category", "")
            internal = _map_naver_category(raw_category)
            return {"category": internal, "raw_category": raw_category}
    except Exception:
        return {"category": None, "raw_category": None}
