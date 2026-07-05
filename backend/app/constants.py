# backend/app/constants.py
"""공용 도메인 상수.

혜택 카테고리는 카드 혜택(catalog_benefits / user_card_benefits)의 category 값과
가맹점(merchants.category)이 공유하는 단일 체계다.
"전체" 혜택은 카테고리가 아니라 benefit.target_type = "all"로 표현한다.
"""

BENEFIT_CATEGORIES = ["식비", "교통", "쇼핑", "의료", "여행", "통신", "주유", "문화/여가"]

# 혜택 타겟 종류: 전 가맹점 / 카테고리 / 특정 가맹점 목록
BENEFIT_TARGET_TYPES = ["all", "category", "merchant"]
