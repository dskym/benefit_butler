import {
  parseAmount,
  parseMerchant,
  parseTransactionType,
  parsePaymentType,
  parseTransactionDate,
  parseFinancialMessage,
  buildDedupKey,
  isFinancialText,
} from '../../utils/smsParser';

describe('isFinancialText', () => {
  it('KB국민카드 승인 SMS를 금융 메시지로 판별한다', () => {
    expect(isFinancialText('[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', 'KB국민카드')).toBe(true);
  });
  it('신한은행 출금 SMS를 금융 메시지로 판별한다', () => {
    expect(isFinancialText('[신한은행] 출금 10,000원 이마트 잔액 245,200원', '신한은행')).toBe(true);
  });
  it('금액 패턴이 없으면 금융 메시지가 아니다', () => {
    expect(isFinancialText('[KB국민카드] 승인 완료', 'KB국민카드')).toBe(false);
  });
  it('금융 키워드가 없으면 금융 메시지가 아니다', () => {
    expect(isFinancialText('오늘 특별 할인 이벤트!', '015012345678')).toBe(false);
  });
  it('금융앱 패키지명 힌트가 있으면 금융 메시지로 판별한다', () => {
    expect(isFinancialText('5,300원 스타벅스 결제', undefined, 'com.kakaobank.channel')).toBe(true);
  });
});

describe('parseAmount', () => {
  it.each([
    ['[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', 5300],
    ['[신한은행] 출금 10,000원 이마트 잔액 245,200원', 10000],
    ['[국민은행] 입금 100,000원 홍길동 잔액 345,200원', 100000],
    ['[하나카드] [결제] 29,500원 올리브영 2026-02-22 14:30', 29500],
  ])('%s → %i원', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });
  it('금액이 없으면 null을 반환한다', () => {
    expect(parseAmount('안녕하세요 광고 문자입니다')).toBeNull();
  });
});

describe('parseTransactionType', () => {
  it.each([
    ['[국민은행] 입금 100,000원 홍길동 잔액 345,200원', 'income'],
    ['[신한은행] 출금 10,000원 이마트 잔액 245,200원', 'expense'],
    ['[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', 'expense'],
  ] as [string, 'income' | 'expense'][])('%s → %s', (text, expected) => {
    expect(parseTransactionType(text)).toBe(expected);
  });
});

describe('parsePaymentType', () => {
  it.each([
    ['[KB국민카드] 5,300원 스타벅스 승인', 'KB국민카드', 'credit_card'],
    ['[신한은행] 출금 10,000원 이마트 잔액', '신한은행', 'bank'],
    ['[카카오뱅크] 결제 완료 12,000원 배달의민족', '카카오뱅크', 'debit_card'],
    ['[토스카드] 결제 3,500원 편의점 2026-02-22', '토스카드', 'credit_card'],
  ] as [string, string, string][])('%s → %s', (text, senderHint, expected) => {
    expect(parsePaymentType(text, senderHint)).toBe(expected);
  });
});

describe('parseMerchant', () => {
  it.each([
    ['[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', '스타벅스'],
    ['[신한은행] 출금 10,000원 이마트 잔액 245,200원', '이마트'],
    ['[국민은행] 입금 100,000원 홍길동 잔액 345,200원', '홍길동'],
    ['[하나카드] [결제] 29,500원 올리브영 2026-02-22 14:30', '올리브영'],
    ['[삼성카드] 승인 45,000원 마켓컬리 01/15', '마켓컬리'],
    ['[토스카드] 결제 3,500원 편의점 2026-02-22', '편의점'],
    ['[카카오뱅크] 결제 완료 12,000원 배달의민족', '배달의민족'],
    ['[현대카드] 3,500원 쿠팡 01/15 23:10', '쿠팡'],
  ])('%s → %s', (text, expected) => {
    expect(parseMerchant(text)).toBe(expected);
  });
});

describe('parseTransactionDate', () => {
  const FALLBACK_TS = 1736913000000;
  it('YYYY-MM-DD HH:MM 형식을 파싱한다', () => {
    expect(parseTransactionDate('[하나카드] [결제] 29,500원 올리브영 2026-02-22 14:30', FALLBACK_TS)).toContain('2026-02-22');
  });
  it('MM/DD HH:MM 형식에서 현재 연도를 적용한다', () => {
    const year = new Date().getFullYear();
    expect(parseTransactionDate('[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', FALLBACK_TS)).toContain(`${year}-01-15`);
  });
  it('날짜 패턴이 없으면 fallback timestamp를 사용한다', () => {
    expect(parseTransactionDate('[카카오뱅크] 결제 완료 12,000원 배달의민족', FALLBACK_TS)).toBe(new Date(FALLBACK_TS).toISOString());
  });
});

describe('buildDedupKey', () => {
  it('같은 거래는 동일 dedup key를 생성한다 (1분 차이)', () => {
    const ts = 1736913000000;
    const key1 = buildDedupKey(5300, '스타벅스', ts);
    const key2 = buildDedupKey(5300, '스타벅스', ts + 60_000);
    expect(key1).toBe(key2);
  });
  it('6분 차이는 다른 dedup key를 생성한다', () => {
    const ts = 1736913000000;
    const key1 = buildDedupKey(5300, '스타벅스', ts);
    const key2 = buildDedupKey(5300, '스타벅스', ts + 6 * 60_000);
    expect(key1).not.toBe(key2);
  });
  it('지점 접미사를 정규화한다 (스타벅스강남점 = 스타벅스)', () => {
    const ts = 1736913000000;
    expect(buildDedupKey(5300, '스타벅스', ts)).toBe(buildDedupKey(5300, '스타벅스강남점', ts));
  });
  it('금액이 다르면 다른 key를 생성한다', () => {
    const ts = 1736913000000;
    expect(buildDedupKey(5300, '스타벅스', ts)).not.toBe(buildDedupKey(5400, '스타벅스', ts));
  });
});

describe('parseFinancialMessage', () => {
  it('KB국민카드 SMS body를 파싱한다', () => {
    expect(parseFinancialMessage(
      '[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30',
      'sms',
      'KB국민카드'
    )).toMatchObject({ amount: 5300, description: '스타벅스', type: 'expense', payment_type: 'credit_card' });
  });
  it('카카오뱅크 푸시 body를 파싱한다', () => {
    expect(parseFinancialMessage(
      '12,000원 배달의민족 결제 완료',
      'push',
      'com.kakaobank.channel'
    )).toMatchObject({ amount: 12000, type: 'expense' });
  });
  it('금융 메시지가 아니면 null을 반환한다', () => {
    expect(parseFinancialMessage('오늘 이벤트 참여하세요!', 'sms', '015012345678')).toBeNull();
  });
  it('금액이 0 이하이면 null을 반환한다', () => {
    expect(parseFinancialMessage('[KB국민카드] 0원 스타벅스 승인 01/15 13:30', 'sms', 'KB국민카드')).toBeNull();
  });
  it('국민은행 입금을 income으로 파싱한다', () => {
    expect(parseFinancialMessage(
      '[국민은행] 입금 100,000원 홍길동 잔액 345,200원',
      'sms',
      '국민은행'
    )).toMatchObject({ type: 'income', amount: 100000 });
  });
});
