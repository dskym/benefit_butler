jest.mock('../../storage', () => ({
  mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

import { useFinancialImportStore } from '../../store/financialImportStore';

const INITIAL_STATE = {
  isSmsEnabled: false,
  isPushEnabled: false,
  importedSmsIds: [],
  dedupSignatures: [],
  lastSmsImportDate: null,
  isImporting: false,
};

beforeEach(() => {
  useFinancialImportStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

describe('setSmsEnabled / setPushEnabled', () => {
  it('SMS 활성화를 true로 설정한다', () => {
    useFinancialImportStore.getState().setSmsEnabled(true);
    expect(useFinancialImportStore.getState().isSmsEnabled).toBe(true);
  });
  it('푸시 활성화를 true로 설정한다', () => {
    useFinancialImportStore.getState().setPushEnabled(true);
    expect(useFinancialImportStore.getState().isPushEnabled).toBe(true);
  });
});

describe('markSmsImportedBatch / isSmsAlreadyImported', () => {
  it('새 SMS ID를 배치로 추가한다', () => {
    useFinancialImportStore.getState().markSmsImportedBatch(['sms-1', 'sms-2']);
    expect(useFinancialImportStore.getState().isSmsAlreadyImported('sms-1')).toBe(true);
    expect(useFinancialImportStore.getState().isSmsAlreadyImported('sms-2')).toBe(true);
  });
  it('존재하지 않는 ID는 false를 반환한다', () => {
    expect(useFinancialImportStore.getState().isSmsAlreadyImported('sms-99')).toBe(false);
  });
  it('중복 ID를 제거한다', () => {
    useFinancialImportStore.getState().markSmsImportedBatch(['sms-1']);
    useFinancialImportStore.getState().markSmsImportedBatch(['sms-1', 'sms-2']);
    expect(useFinancialImportStore.getState().importedSmsIds.filter(id => id === 'sms-1')).toHaveLength(1);
  });
  it('1000개 초과 시 최신 1000개만 유지한다', () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `sms-${i}`);
    useFinancialImportStore.getState().markSmsImportedBatch(ids);
    expect(useFinancialImportStore.getState().importedSmsIds).toHaveLength(1000);
    expect(useFinancialImportStore.getState().importedSmsIds).toContain('sms-1000');
    expect(useFinancialImportStore.getState().importedSmsIds).not.toContain('sms-0');
  });
});

describe('markDedupSig / hasDedupSig', () => {
  it('새 dedup key를 추가한다', () => {
    useFinancialImportStore.getState().markDedupSig('5300:스타벅스:57896');
    expect(useFinancialImportStore.getState().hasDedupSig('5300:스타벅스:57896')).toBe(true);
  });
  it('존재하지 않는 key는 false를 반환한다', () => {
    expect(useFinancialImportStore.getState().hasDedupSig('9999:없음:0')).toBe(false);
  });
  it('3000개 초과 시 최신 3000개만 유지한다', () => {
    const keys = Array.from({ length: 3001 }, (_, i) => `key-${i}`);
    keys.forEach(k => useFinancialImportStore.getState().markDedupSig(k));
    expect(useFinancialImportStore.getState().dedupSignatures).toHaveLength(3000);
    expect(useFinancialImportStore.getState().dedupSignatures).toContain('key-3000');
    expect(useFinancialImportStore.getState().dedupSignatures).not.toContain('key-0');
  });
});

describe('setImporting / setLastSmsImportDate', () => {
  it('isImporting을 true로 설정한다', () => {
    useFinancialImportStore.getState().setImporting(true);
    expect(useFinancialImportStore.getState().isImporting).toBe(true);
  });
  it('lastSmsImportDate를 설정한다', () => {
    useFinancialImportStore.getState().setLastSmsImportDate(1700000000000);
    expect(useFinancialImportStore.getState().lastSmsImportDate).toBe(1700000000000);
  });
});
