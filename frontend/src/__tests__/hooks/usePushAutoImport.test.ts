let capturedAppStateCallback: ((state: string) => void) | null = null;

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: jest.fn().mockImplementation((_event: string, cb: (state: string) => void) => {
      capturedAppStateCallback = cb;
      return { remove: jest.fn() };
    }),
  },
  ToastAndroid: { show: jest.fn(), SHORT: 1 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-notification-listener', () => ({
  getPermissionStatus: jest.fn().mockResolvedValue('authorized'),
  requestPermission: jest.fn(),
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, ToastAndroid } from 'react-native';
import { usePushAutoImport } from '../../hooks/usePushAutoImport';
import { useFinancialImportStore } from '../../store/financialImportStore';

const PENDING_PUSH_STORAGE_KEY = '@benefit_butler/pending_push';

const INITIAL_STORE = {
  isSmsEnabled: false,
  isPushEnabled: true,
  importedSmsIds: [],
  dedupSignatures: [],
  lastSmsImportDate: null,
  isImporting: false,
};

const PENDING_ITEM = {
  amount: 5300,
  description: '스타벅스',
  type: 'expense' as const,
  transacted_at: new Date(1736913000000).toISOString(),
  payment_type: 'credit_card' as const,
  dedupKey: `5300:스타벅스:${Math.floor(1736913000000 / 300000)}`,
};

beforeEach(() => {
  jest.clearAllMocks();
  capturedAppStateCallback = null;
  useFinancialImportStore.setState(INITIAL_STORE);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  mockCreateTransaction.mockResolvedValue(undefined);
  const NL = require('react-native-notification-listener');
  (NL.getPermissionStatus as jest.Mock).mockResolvedValue('authorized');
  (AppState.addEventListener as jest.Mock).mockImplementation((_event: string, cb: (state: string) => void) => {
    capturedAppStateCallback = cb;
    return { remove: jest.fn() };
  });
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('usePushAutoImport', () => {
  it('isPushEnabled가 false이면 아무것도 하지 않는다', async () => {
    useFinancialImportStore.setState({ ...INITIAL_STORE, isPushEnabled: false });
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('권한이 있으면 requestPermission을 호출하지 않는다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    const NL = require('react-native-notification-listener');
    expect(NL.requestPermission).not.toHaveBeenCalled();
  });

  it('권한이 없으면 requestPermission을 호출한다', async () => {
    const NL = require('react-native-notification-listener');
    (NL.getPermissionStatus as jest.Mock).mockResolvedValue('denied');
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(NL.requestPermission).toHaveBeenCalled();
  });

  it('pending 항목이 있으면 createTransaction을 호출한다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([PENDING_ITEM]));
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5300, description: '스타벅스' }),
      expect.any(Boolean)
    );
  });

  it('처리된 항목은 AsyncStorage에서 제거된다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([PENDING_ITEM]));
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PENDING_PUSH_STORAGE_KEY,
      JSON.stringify([])
    );
  });

  it('dedup 서명이 있는 항목은 createTransaction을 호출하지 않는다', async () => {
    useFinancialImportStore.setState({ ...INITIAL_STORE, dedupSignatures: [PENDING_ITEM.dedupKey] });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([PENDING_ITEM]));
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });

  it('거래 추가 후 dedupSignatures에 서명을 저장한다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([PENDING_ITEM]));
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(useFinancialImportStore.getState().dedupSignatures).toContain(PENDING_ITEM.dedupKey);
  });

  it('거래 추가 후 ToastAndroid로 알림을 표시한다', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([PENDING_ITEM]));
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expect.stringContaining('1건의 거래를 추가했습니다'),
      expect.any(Number)
    );
  });

  it('AppState active 이벤트 시 pending 항목을 다시 처리한다', async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify([PENDING_ITEM]));

    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });

    await act(async () => {
      capturedAppStateCallback?.('active');
      await flush();
    });

    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
  });
});
