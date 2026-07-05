// frontend/src/utils/benefitCategories.ts
// 혜택 카테고리 체계 — backend/app/constants.py의 BENEFIT_CATEGORIES와 일치해야 함.
// "전체"는 카테고리가 아니라 혜택의 target_type="all"로 표현된다.

export const BENEFIT_CATEGORIES = [
  "식비",
  "교통",
  "쇼핑",
  "의료",
  "여행",
  "통신",
  "주유",
  "문화/여가",
];

/**
 * 거래(transaction) 카테고리명 → 혜택 카테고리명 매핑.
 * 거래 카테고리 자체는 사용자 데이터라 리네임하지 않고 조회 시 변환만 한다.
 */
const TRANSACTION_TO_BENEFIT: Record<string, string> = {
  "의료·건강": "의료",
  "문화·여가": "문화/여가",
  "주거·통신": "통신",
};

export function toBenefitCategory(transactionCategory: string): string | null {
  if (BENEFIT_CATEGORIES.includes(transactionCategory)) return transactionCategory;
  return TRANSACTION_TO_BENEFIT[transactionCategory] ?? null;
}
