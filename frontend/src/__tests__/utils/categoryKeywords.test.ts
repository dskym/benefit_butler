import { Category, Transaction } from '../../types';
import {
  normalizeDescription,
  suggestCategory,
} from '../../utils/categoryKeywords';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    category_id: null,
    type: 'expense',
    amount: 5000,
    description: null,
    transacted_at: '2026-02-01T10:00:00Z',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    payment_type: null,
    user_card_id: null,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    name: '식비',
    type: 'expense',
    color: null,
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// 기본 카테고리 (backend DEFAULT_CATEGORIES와 동일한 이름)
const shikbiCategory    = makeCategory({ id: 'cat-shikbi',    name: '식비',     type: 'expense' });
const transportCategory = makeCategory({ id: 'cat-transport', name: '교통',     type: 'expense' });
const uiroCategory      = makeCategory({ id: 'cat-uiro',      name: '의료·건강', type: 'expense' });
const jugeoCategory     = makeCategory({ id: 'cat-jugeo',     name: '주거·통신', type: 'expense' });
const shoppingCategory  = makeCategory({ id: 'cat-shopping',  name: '쇼핑',     type: 'expense' });
const cultCategory      = makeCategory({ id: 'cat-cult',      name: '문화·여가', type: 'expense' });
const eduCategory       = makeCategory({ id: 'cat-edu',       name: '교육',     type: 'expense' });
const financeCategory   = makeCategory({ id: 'cat-finance',   name: '금융',     type: 'expense' });
const celebCategory     = makeCategory({ id: 'cat-celeb',     name: '경조사',   type: 'expense' });
const shikbiIncomeCategory = makeCategory({ id: 'cat-income', name: '식비',     type: 'income' });

const defaultCategories: Category[] = [
  shikbiCategory,
  transportCategory,
  uiroCategory,
  jugeoCategory,
  shoppingCategory,
  cultCategory,
  eduCategory,
  financeCategory,
  celebCategory,
  shikbiIncomeCategory,
];

// ─── normalizeDescription ─────────────────────────────────────────────────────

describe('normalizeDescription', () => {
  it('removes bracket prefixes like [국민카드]', () => {
    expect(normalizeDescription('[국민카드] 스타벅스 강남점')).toBe(
      '스타벅스 강남점',
    );
  });

  it('collapses multiple spaces', () => {
    expect(normalizeDescription('스타벅스  강남점')).toBe('스타벅스 강남점');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeDescription('  스타벅스  ')).toBe('스타벅스');
  });

  it('lowercases ASCII characters', () => {
    expect(normalizeDescription('Starbucks')).toBe('starbucks');
  });
});

// ─── suggestCategory ──────────────────────────────────────────────────────────

describe('suggestCategory', () => {
  // 1. 히스토리 기반 추천
  it('returns category from history when matching past transaction exists', () => {
    const history = [
      makeTransaction({ description: '스타벅스 강남점', category_id: 'cat-shikbi', type: 'expense' }),
    ];
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'history' });
  });

  // 2. 카페 → 식비
  it('returns 식비 for cafe keyword when no history exists', () => {
    const result = suggestCategory('스타벅스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 2-b. 편의점 → 식비
  it('returns 식비 for convenience store keyword', () => {
    const result = suggestCategory('GS25', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 2-c. 주유소 → 교통
  it('returns 교통 for gas station keyword', () => {
    const result = suggestCategory('GS칼텍스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-transport', method: 'keyword' });
  });

  // 3. 추천 없음
  it('returns null when nothing matches', () => {
    const result = suggestCategory('알수없는가맹점', 'expense', [], defaultCategories);
    expect(result).toBeNull();
  });

  // 4. 히스토리 우선
  it('prefers history over keyword when both match', () => {
    // history가 교통으로 분류했어도 히스토리 우선
    const history = [
      makeTransaction({ description: '스타벅스', category_id: 'cat-transport', type: 'expense' }),
    ];
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-transport', method: 'history' });
  });

  // 5. type 격리
  it('does not use income transactions when suggesting for expense type', () => {
    const history = [
      makeTransaction({ description: '스타벅스', category_id: 'cat-income', type: 'income' }),
    ];
    // income history 무시 → keyword fallback → 식비 expense
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 6. description 2자 미만
  it('returns null when description is shorter than 2 characters', () => {
    expect(suggestCategory('스', 'expense', [], defaultCategories)).toBeNull();
    expect(suggestCategory('', 'expense', [], defaultCategories)).toBeNull();
  });

  // 7. 대소문자 무시 — KFC는 식비
  it('matches keywords case-insensitively', () => {
    const result = suggestCategory('kfc 강남점', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 8. 성능 경계: 301번째 이후 거래는 히스토리 검색에 포함 안 됨
  it('only searches the most recent 300 transactions', () => {
    const history: Transaction[] = Array.from({ length: 300 }, (_, i) =>
      makeTransaction({ id: `tx-${i}`, description: '다른가맹점', category_id: null }),
    );
    // 301번째 (index 300) — 검색에 포함되지 않아야 함
    history.push(
      makeTransaction({ id: 'tx-300', description: '스타벅스', category_id: 'cat-shikbi', type: 'expense' }),
    );
    // history miss → keyword → 식비
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 9. SMS 접두어 정규화
  it('matches through SMS bracket prefix normalization', () => {
    const result = suggestCategory('[국민카드] 스타벅스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shikbi', method: 'keyword' });
  });

  // 10. 토큰 매칭: "GS칼텍스 서초주유소" → 교통
  it('matches gas station via token splitting and maps to 교통', () => {
    const result = suggestCategory('GS칼텍스 서초주유소', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-transport', method: 'keyword' });
  });

  // 11. 의료·건강 매핑
  it('returns 의료·건강 for medical keywords', () => {
    const result = suggestCategory('강남약국', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-uiro', method: 'keyword' });
  });

  // 12. 주거·통신 매핑
  it('returns 주거·통신 for telecom keywords', () => {
    const result = suggestCategory('SKT 자동이체', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-jugeo', method: 'keyword' });
  });

  // 13. 문화·여가 — OTT
  it('returns 문화·여가 for OTT service keywords', () => {
    const result = suggestCategory('넷플릭스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cult', method: 'keyword' });
  });

  // 14. 문화·여가 — 영화관
  it('returns 문화·여가 for cinema keywords', () => {
    const result = suggestCategory('CGV 강남', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cult', method: 'keyword' });
  });

  // 15. 문화·여가 — 여행
  it('returns 문화·여가 for travel keywords', () => {
    const result = suggestCategory('야놀자 호텔예약', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cult', method: 'keyword' });
  });

  // 16. 교육 — 온라인 강의
  it('returns 교육 for online education keywords', () => {
    const result = suggestCategory('인프런 강의결제', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-edu', method: 'keyword' });
  });

  // 17. 교육 — 어학원
  it('returns 교육 for language school keywords', () => {
    const result = suggestCategory('해커스토익 수강료', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-edu', method: 'keyword' });
  });

  // 18. 금융 — 보험료
  it('returns 금융 for insurance keywords', () => {
    const result = suggestCategory('삼성화재 보험료', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-finance', method: 'keyword' });
  });

  // 19. 경조사 — 꽃집
  it('returns 경조사 for flower shop keywords', () => {
    const result = suggestCategory('강남꽃집', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-celeb', method: 'keyword' });
  });

  // 20. 쇼핑 — 백화점
  it('returns 쇼핑 for department store keywords', () => {
    const result = suggestCategory('롯데백화점 본점', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-shopping', method: 'keyword' });
  });

  // 21. 교통 — 항공
  it('returns 교통 for airline keywords', () => {
    const result = suggestCategory('제주항공 예매', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-transport', method: 'keyword' });
  });
});
