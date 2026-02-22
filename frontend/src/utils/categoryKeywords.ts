import { Category, Transaction } from '../types';

/** 카테고리명 → 가맹점 키워드 목록 */
export const MERCHANT_KEYWORDS: Record<string, string[]> = {
  카페: ['스타벅스', '이디야', '투썸', '할리스', '메가커피', '빽다방', '커피빈', '폴바셋'],
  편의점: ['GS25', 'CU', '세븐일레븐', '이마트24', '미니스톱'],
  마트: ['이마트', '홈플러스', '롯데마트', '코스트코', '하나로마트'],
  외식: [
    '맥도날드', '버거킹', '롯데리아', 'KFC', '파파존스', '도미노', '피자헛',
    '교촌', 'BBQ', 'bhc', '굽네치킨',
  ],
  교통: ['지하철', '버스', '카카오T', '우티', '코레일', 'KTX'],
  주유: ['SK주유소', 'GS칼텍스', '현대오일뱅크', 'S-OIL', '오일뱅크'],
  쇼핑: ['쿠팡', '11번가', 'G마켓', '옥션', '무신사', '올리브영'],
  의료: ['약국', '병원', '의원', '클리닉', '한의원', '치과', '안과'],
  통신: ['SKT', 'KT', 'LGU+', 'LG유플러스', 'SK텔레콤'],
};

/**
 * SMS 카드 접두어 제거, 공백 정리, 소문자 변환
 * "[국민카드] 스타벅스 강남점" → "스타벅스 강남점"
 */
export function normalizeDescription(description: string): string {
  return description
    .replace(/\[.*?\]/g, '') // [국민카드], [신한카드] 등 제거
    .replace(/\s+/g, ' ')    // 다중 공백 단일화
    .trim()
    .toLowerCase();
}

export interface SuggestResult {
  categoryId: string;
  method: 'history' | 'keyword';
}

/**
 * description + 사용자 히스토리 + 카테고리 목록을 받아 추천 카테고리를 반환하는 순수 함수.
 *
 * 처리 순서:
 *   1. 최근 300건 히스토리에서 동일 type, description 포함 거래의 가장 많이 쓴 category_id
 *   2. MERCHANT_KEYWORDS 키워드 토큰 매칭
 *   3. 없으면 null
 */
export function suggestCategory(
  description: string,
  transactionType: string,
  transactions: Transaction[],
  categories: Category[],
): SuggestResult | null {
  if (description.length < 2) return null;

  const normalized = normalizeDescription(description);
  const tokens = normalized.split(' ').filter(t => t.length >= 2);

  // Step 1: 히스토리 검색 — 최근 300건만
  const freq: Record<string, number> = {};
  transactions
    .slice(0, 300)
    .filter(
      t =>
        t.type === transactionType &&
        t.category_id != null &&
        normalizeDescription(t.description ?? '').includes(normalized),
    )
    .forEach(t => {
      freq[t.category_id!] = (freq[t.category_id!] ?? 0) + 1;
    });

  const topEntry = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (topEntry) return { categoryId: topEntry[0], method: 'history' };

  // Step 2: 키워드 규칙 — 토큰 단위 매칭
  for (const [catName, keywords] of Object.entries(MERCHANT_KEYWORDS)) {
    const matched = keywords.some(k =>
      tokens.some(
        token =>
          token.includes(k.toLowerCase()) || k.toLowerCase().includes(token),
      ),
    );
    if (matched) {
      const cat = categories.find(
        c => c.name === catName && c.type === transactionType,
      );
      if (cat) return { categoryId: cat.id, method: 'keyword' };
    }
  }

  return null;
}
