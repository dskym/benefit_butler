import { FINANCIAL_APP_PACKAGES } from './financialAppPackages';

export interface ParsedFinancialMessage {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  transacted_at: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank' | 'cash';
}

const FINANCIAL_SENDER_NAMES = [
  'KB국민', '신한', '하나', '우리', '기업', '국민은행', '농협', 'NH',
  '삼성카드', '현대카드', '롯데카드', '토스카드', '카카오뱅크', '케이뱅크',
  'SC제일', '씨티', '토스뱅크',
];
const FINANCIAL_BODY_KEYWORDS = ['승인', '결제', '출금', '입금', '이체', '완료', '사용', '거래'];
const AMOUNT_REGEX = /(\d+(?:,\d{3})*)(?:\.\d+)?원/;

export function isFinancialText(
  text: string,
  senderHint?: string,
  packageHint?: string,
): boolean {
  if (packageHint && FINANCIAL_APP_PACKAGES.includes(packageHint as any)) {
    return AMOUNT_REGEX.test(text) && FINANCIAL_BODY_KEYWORDS.some(kw => text.includes(kw));
  }
  const senderIsFinancial = senderHint
    ? FINANCIAL_SENDER_NAMES.some(name => senderHint.includes(name))
    : false;
  if (!senderIsFinancial) return false;
  return FINANCIAL_BODY_KEYWORDS.some(kw => text.includes(kw)) && AMOUNT_REGEX.test(text);
}

export function parseAmount(text: string): number | null {
  const match = AMOUNT_REGEX.exec(text);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(value) ? null : value;
}

const INCOME_KEYWORDS = ['입금', '환급', '환불', '수령'];

export function parseTransactionType(text: string): 'income' | 'expense' {
  return INCOME_KEYWORDS.some(kw => text.includes(kw)) ? 'income' : 'expense';
}

export function parsePaymentType(
  text: string,
  senderHint?: string,
): 'credit_card' | 'debit_card' | 'bank' | 'cash' {
  const combined = (senderHint ?? '') + text;
  if (combined.includes('체크') || combined.includes('직불') ||
      combined.includes('카카오뱅크') || combined.includes('케이뱅크') || combined.includes('토스뱅크'))
    return 'debit_card';
  if (combined.includes('카드') ||
      /(KB국민|신한|하나|현대|삼성|롯데|비씨|씨티|우리)카드/.test(combined) ||
      combined.includes('토스카드'))
    return 'credit_card';
  if (combined.includes('은행') || combined.includes('뱅크') || /출금|입금|이체/.test(text))
    return 'bank';
  return 'cash';
}

const MERCHANT_PATTERNS: RegExp[] = [
  /(?:출금|입금)\s+[\d,]+원\s+(.+?)\s+잔액/,
  /\[결제\]\s+[\d,]+원\s+(.+?)\s+\d{4}-\d{2}-\d{2}/,
  /[\d,]+원\s+(.+?)\s+승인\s+\d{2}\/\d{2}/,
  /결제 완료\s+[\d,]+원\s+(.+?)(?:\s|$)/,
  /결제\s+[\d,]+원\s+(.+?)\s+\d{4}-\d{2}-\d{2}/,
  /(?:승인\s+)?[\d,]+원\s+(.+?)\s+\d{2}\/\d{2}/,
  /[\d,]+원\s+(.+?)(?:\s+\d|\s*$)/,
];

export function parseMerchant(text: string): string {
  const cleaned = text.replace(/\[.*?\]/g, '').trim();
  for (const pattern of MERCHANT_PATTERNS) {
    const match = pattern.exec(cleaned);
    if (match?.[1]) return match[1].trim();
  }
  return cleaned.replace(AMOUNT_REGEX, '').trim().slice(0, 40);
}

const DATE_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpExecArray) => Date }> = [
  {
    regex: /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/,
    parse: m => new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`),
  },
  {
    regex: /(\d{4})-(\d{2})-(\d{2})(?!\s*\d{2}:\d{2})/,
    parse: m => new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`),
  },
  {
    regex: /(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/,
    parse: m => new Date(`${new Date().getFullYear()}-${m[1]}-${m[2]}T${m[3]}:${m[4]}:00+09:00`),
  },
  {
    regex: /(\d{2})\/(\d{2})(?!\s*\d{2}:\d{2})/,
    parse: m => new Date(`${new Date().getFullYear()}-${m[1]}-${m[2]}T00:00:00+09:00`),
  },
];

export function parseTransactionDate(text: string, fallbackTimestampMs: number): string {
  const cleaned = text.replace(/\[.*?\]/g, '');
  for (const { regex, parse } of DATE_PATTERNS) {
    const m = regex.exec(cleaned);
    if (m) {
      const d = parse(m);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return new Date(fallbackTimestampMs).toISOString();
}

const FIVE_MIN_MS = 300_000;

function normalizeMerchant(merchant: string): string {
  const noSpace = merchant.replace(/\s/g, '').toLowerCase();
  // Strip 2-char location + branch suffix (e.g., 강남점) only if base >= 3 chars remain
  const try2 = noSpace.replace(/[가-힣]{2}(?:점|지점|매장|센터)$/, '');
  if (try2.length >= 3 && try2 !== noSpace) return try2;
  // Strip 3-char location + branch suffix (e.g., 서울역점) only if base >= 3 chars remain
  const try3 = noSpace.replace(/[가-힣]{3}(?:점|지점|매장|센터)$/, '');
  if (try3.length >= 3 && try3 !== noSpace) return try3;
  return noSpace.replace(/(branch|store)$/i, '') || noSpace;
}

export function buildDedupKey(amount: number, merchant: string, tsMs: number): string {
  const bucket = Math.floor(tsMs / FIVE_MIN_MS);
  return `${amount}:${normalizeMerchant(merchant)}:${bucket}`;
}

export function parseFinancialMessage(
  text: string,
  source: 'sms' | 'push',
  senderHint?: string,
): ParsedFinancialMessage | null {
  const packageHint = source === 'push' ? senderHint : undefined;
  const smsSender = source === 'sms' ? senderHint : undefined;
  if (!isFinancialText(text, smsSender, packageHint)) return null;
  const amount = parseAmount(text);
  if (!amount || amount <= 0) return null;
  return {
    amount,
    description: parseMerchant(text),
    type: parseTransactionType(text),
    transacted_at: parseTransactionDate(text, Date.now()),
    payment_type: parsePaymentType(text, smsSender),
  };
}
