"""가맹점명 정규화 및 해석(resolve).

PR1: 시드 로더가 별칭 저장 시 사용하는 normalize_merchant_name만 제공.
PR2에서 resolve_merchant_local / resolve_merchant(Naver 폴백)가 추가된다.
"""
import re

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
