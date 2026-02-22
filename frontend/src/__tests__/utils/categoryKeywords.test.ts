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
    name: '카페',
    type: 'expense',
    color: null,
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const cafeCategory = makeCategory({ id: 'cat-cafe', name: '카페', type: 'expense' });
const transportCategory = makeCategory({ id: 'cat-transport', name: '교통', type: 'expense' });
const gasCategory = makeCategory({ id: 'cat-gas', name: '주유', type: 'expense' });
const incomeCategory = makeCategory({ id: 'cat-income', name: '카페', type: 'income' });

const defaultCategories: Category[] = [
  cafeCategory,
  transportCategory,
  gasCategory,
  incomeCategory,
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
      makeTransaction({ description: '스타벅스 강남점', category_id: 'cat-cafe', type: 'expense' }),
    ];
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cafe', method: 'history' });
  });

  // 2. 키워드 기반 추천
  it('returns keyword match when no history exists', () => {
    const result = suggestCategory('스타벅스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cafe', method: 'keyword' });
  });

  // 3. 추천 없음
  it('returns null when nothing matches', () => {
    const result = suggestCategory('알수없는가맹점', 'expense', [], defaultCategories);
    expect(result).toBeNull();
  });

  // 4. 히스토리 우선
  it('prefers history over keyword when both match', () => {
    // history says transport, but keyword would say cafe
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
    // income history should be ignored; falls back to keyword → expense 카페
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cafe', method: 'keyword' });
  });

  // 6. description 2자 미만
  it('returns null when description is shorter than 2 characters', () => {
    expect(suggestCategory('스', 'expense', [], defaultCategories)).toBeNull();
    expect(suggestCategory('', 'expense', [], defaultCategories)).toBeNull();
  });

  // 7. 대소문자 무시
  it('matches keywords case-insensitively', () => {
    const cafeEnCategory = makeCategory({ id: 'cat-cafe-en', name: '카페', type: 'expense' });
    // 영문 스타벅스 — "starbucks" should match "스타벅스" keyword?
    // Actually the keyword list uses Korean. Let's test with a keyword that IS in the list with Korean.
    // For ASCII, "KFC" is in 외식 keywords. Test KFC lower-cased.
    const foodCategory = makeCategory({ id: 'cat-food', name: '외식', type: 'expense' });
    const result = suggestCategory('kfc 강남점', 'expense', [], [...defaultCategories, foodCategory]);
    expect(result).toEqual({ categoryId: 'cat-food', method: 'keyword' });
  });

  // 8. 성능 경계: 301번째 이후 거래는 히스토리 검색에 포함 안 됨
  it('only searches the most recent 300 transactions', () => {
    // 0..299 → no match; index 300 → match (should be excluded)
    const history: Transaction[] = Array.from({ length: 300 }, (_, i) =>
      makeTransaction({ id: `tx-${i}`, description: '다른가맹점', category_id: null }),
    );
    // Add matching transaction at position 300 (index 300, 301st item)
    history.push(
      makeTransaction({ id: 'tx-300', description: '스타벅스', category_id: 'cat-cafe', type: 'expense' }),
    );
    // should NOT find history match; keyword should kick in
    const result = suggestCategory('스타벅스', 'expense', history, defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cafe', method: 'keyword' });
  });

  // 9. SMS 접두어 정규화
  it('matches through SMS bracket prefix normalization', () => {
    const result = suggestCategory('[국민카드] 스타벅스', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-cafe', method: 'keyword' });
  });

  // 10. 토큰 매칭: "GS칼텍스 서초주유소" → 주유 키워드에 매칭
  it('matches via token splitting for compound merchant names', () => {
    const result = suggestCategory('GS칼텍스 서초주유소', 'expense', [], defaultCategories);
    expect(result).toEqual({ categoryId: 'cat-gas', method: 'keyword' });
  });
});
