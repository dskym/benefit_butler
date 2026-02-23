jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    request: jest.fn(),
    PERMISSIONS: { READ_SMS: 'android.permission.READ_SMS' },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  },
  ToastAndroid: { show: jest.fn(), SHORT: 1 },
}));

jest.mock('react-native-get-sms-android', () => ({
  list: jest.fn(),
}));

jest.mock('../../storage', () => ({
  mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

const mockCreateTransaction = jest.fn().mockResolvedValue(undefined);

jest.mock('../../store/transactionStore', () => ({
  useTransactionStore: jest.fn((selector: any) =>
    selector({ createTransaction: mockCreateTransaction })
  ),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ type: 'wifi', isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
}));

import { renderHook, act } from '@testing-library/react-native';
import { PermissionsAndroid, ToastAndroid } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { useSmsAutoImport } from '../../hooks/useSmsAutoImport';
import { useFinancialImportStore } from '../../store/financialImportStore';

const INITIAL_STORE = {
  isSmsEnabled: true,
  isPushEnabled: false,
  importedSmsIds: [],
  dedupSignatures: [],
  lastSmsImportDate: null,
  isImporting: false,
};

const SAMPLE_SMS = JSON.stringify([
  { _id: 'sms-1', address: 'KB국민카드', body: '[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30', date: '1736913000000' },
  { _id: 'sms-2', address: '광고발신자', body: '오늘 이벤트 참여하세요!', date: '1736913000000' },
]);

beforeEach(() => {
  jest.clearAllMocks();
  useFinancialImportStore.setState(INITIAL_STORE);
  (PermissionsAndroid.request as jest.Mock).mockResolvedValue('granted');
  (SmsAndroid.list as jest.Mock).mockImplementation((_f: string, _err: Function, ok: Function) => ok(2, SAMPLE_SMS));
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('useSmsAutoImport', () => {
  it('Android에서 READ_SMS 권한을 요청한다', async () => {
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(PermissionsAndroid.request).toHaveBeenCalledWith('android.permission.READ_SMS', expect.any(Object));
  });
  it('금융 SMS만 파싱하여 createTransaction을 1번 호출한다', async () => {
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5300, description: '스타벅스' }),
      expect.any(Boolean)
    );
  });
  it('처리된 SMS ID를 importedSmsIds에 저장한다', async () => {
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(useFinancialImportStore.getState().importedSmsIds).toContain('sms-1');
  });
  it('dedup 서명을 dedupSignatures에 저장한다', async () => {
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(useFinancialImportStore.getState().dedupSignatures.length).toBeGreaterThan(0);
  });
  it('이미 처리된 SMS ID는 다시 추가하지 않는다', async () => {
    useFinancialImportStore.setState({ ...INITIAL_STORE, importedSmsIds: ['sms-1'] });
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
  it('dedup 서명이 이미 있으면 createTransaction을 호출하지 않는다 (cross-source 중복 방지)', async () => {
    const key = `5300:스타벅스:${Math.floor(1736913000000 / 300000)}`;
    useFinancialImportStore.setState({ ...INITIAL_STORE, dedupSignatures: [key] });
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
  it('isSmsEnabled가 false이면 SMS를 읽지 않는다', async () => {
    useFinancialImportStore.setState({ ...INITIAL_STORE, isSmsEnabled: false });
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });
  it('권한 거부 시 SMS를 읽지 않는다', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue('denied');
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
  it('추가 후 ToastAndroid로 알림을 표시한다', async () => {
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expect.stringContaining('1건의 거래를 추가했습니다'),
      expect.any(Number)
    );
  });
  it('lastSmsImportDate를 갱신한다', async () => {
    const before = Date.now();
    renderHook(() => useSmsAutoImport());
    await act(async () => { await flush(); });
    expect(useFinancialImportStore.getState().lastSmsImportDate).toBeGreaterThanOrEqual(before);
  });
});
