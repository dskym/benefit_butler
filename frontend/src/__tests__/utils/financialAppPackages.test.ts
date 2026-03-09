import { FINANCIAL_APP_PACKAGES } from '../../utils/financialAppPackages';

describe('FINANCIAL_APP_PACKAGES', () => {
  it('비어있지 않은 배열이다', () => {
    expect(Array.isArray(FINANCIAL_APP_PACKAGES)).toBe(true);
    expect(FINANCIAL_APP_PACKAGES.length).toBeGreaterThan(0);
  });

  it('인터넷 전문은행 패키지를 포함한다 (kakaobank, toss, kbank)', () => {
    expect(FINANCIAL_APP_PACKAGES).toContain('com.kakaobank.channel');
    expect(FINANCIAL_APP_PACKAGES).toContain('viva.republica.toss');
    expect(FINANCIAL_APP_PACKAGES).toContain('com.kbankwith.smartbank');
  });

  it('시중은행 패키지를 포함한다 (kbstar, shinhan, woori)', () => {
    expect(FINANCIAL_APP_PACKAGES).toContain('com.kbstar.kbbank');
    expect(FINANCIAL_APP_PACKAGES).toContain('com.shinhan.sbanking');
    expect(FINANCIAL_APP_PACKAGES).toContain('com.wooribank.pib.smart');
  });

  it('카드사 패키지를 포함한다 (hyundaicard, samsungcard)', () => {
    expect(FINANCIAL_APP_PACKAGES).toContain('com.hyundaicard.hcard');
    expect(FINANCIAL_APP_PACKAGES).toContain('com.samsungcard.lifestyle');
  });

  it('중복 패키지명이 없다', () => {
    const unique = new Set(FINANCIAL_APP_PACKAGES);
    expect(unique.size).toBe(FINANCIAL_APP_PACKAGES.length);
  });
});
