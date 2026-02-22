jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: { openSettings: jest.fn() },
  ToastAndroid: { show: jest.fn(), SHORT: 1 },
}));

let capturedNotificationCallback: ((data: any) => void) | null = null;

jest.mock('react-native-notification-listener', () => ({
  __esModule: true,
  default: {
    isPermitted: jest.fn().mockResolvedValue(true),
    requestPermission: jest.fn(),
    startListening: jest.fn(),
    stopListening: jest.fn(),
    addListener: jest.fn().mockImplementation((_event: string, cb: (data: any) => void) => {
      capturedNotificationCallback = cb;
      return { remove: jest.fn() };
    }),
  },
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
  configure: jest.fn(),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(jest.fn()),
}));

import { renderHook, act } from '@testing-library/react-native';
import NotificationListener from 'react-native-notification-listener';
import { ToastAndroid } from 'react-native';
import { usePushAutoImport } from '../../hooks/usePushAutoImport';
import { useFinancialImportStore } from '../../store/financialImportStore';

const INITIAL_STORE = {
  isSmsEnabled: false,
  isPushEnabled: true,
  importedSmsIds: [],
  dedupSignatures: [],
  lastSmsImportDate: null,
  isImporting: false,
};

const FINANCIAL_NOTIFICATION = {
  app: 'com.kakaobank.channel',
  title: 'KB국민카드',
  text: '[KB국민카드] 5,300원 스타벅스 승인 01/15 13:30',
  bigText: '',
  titleBig: '',
  subText: '',
  summaryText: '',
  audioContentsURI: '',
  imageBackgroundURI: '',
  extraInfoText: '',
  groupedMessages: [],
  icon: '',
  isClearable: true,
  ongoing: false,
  time: '1736913000000',
};

beforeEach(() => {
  jest.clearAllMocks();
  capturedNotificationCallback = null;
  useFinancialImportStore.setState(INITIAL_STORE);
  (NotificationListener.isPermitted as jest.Mock).mockResolvedValue(true);
  (NotificationListener.addListener as jest.Mock).mockImplementation((_e: string, cb: (data: any) => void) => {
    capturedNotificationCallback = cb;
    return { remove: jest.fn() };
  });
  mockCreateTransaction.mockResolvedValue(undefined);
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('usePushAutoImport', () => {
  it('isPushEnabled가 true이면 알림 리스너를 시작한다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(NotificationListener.startListening).toHaveBeenCalled();
  });
  it('금융앱 패키지의 금융 알림을 파싱하여 거래를 추가한다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => {
      await flush();
      capturedNotificationCallback?.(FINANCIAL_NOTIFICATION);
      await flush();
    });
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5300 }),
      expect.any(Boolean)
    );
  });
  it('금융앱이 아닌 패키지의 알림은 무시한다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => {
      await flush();
      capturedNotificationCallback?.({ ...FINANCIAL_NOTIFICATION, app: 'com.example.app' });
      await flush();
    });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
  it('이미 dedup 서명이 있는 알림은 추가하지 않는다', async () => {
    const key = `5300:스타벅스:${Math.floor(1736913000000 / 300000)}`;
    useFinancialImportStore.setState({ ...INITIAL_STORE, dedupSignatures: [key] });
    renderHook(() => usePushAutoImport());
    await act(async () => {
      await flush();
      capturedNotificationCallback?.(FINANCIAL_NOTIFICATION);
      await flush();
    });
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
  it('거래 추가 후 dedup 서명을 저장한다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => {
      await flush();
      capturedNotificationCallback?.(FINANCIAL_NOTIFICATION);
      await flush();
    });
    expect(useFinancialImportStore.getState().dedupSignatures.length).toBeGreaterThan(0);
  });
  it('isPushEnabled가 false이면 리스너를 시작하지 않는다', async () => {
    useFinancialImportStore.setState({ ...INITIAL_STORE, isPushEnabled: false });
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(NotificationListener.startListening).not.toHaveBeenCalled();
  });
  it('권한이 없으면 리스너를 시작하지 않는다', async () => {
    (NotificationListener.isPermitted as jest.Mock).mockResolvedValue(false);
    renderHook(() => usePushAutoImport());
    await act(async () => { await flush(); });
    expect(NotificationListener.startListening).not.toHaveBeenCalled();
  });
  it('거래 추가 후 ToastAndroid로 알림을 표시한다', async () => {
    renderHook(() => usePushAutoImport());
    await act(async () => {
      await flush();
      capturedNotificationCallback?.(FINANCIAL_NOTIFICATION);
      await flush();
    });
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expect.stringContaining('스타벅스'),
      expect.any(Number)
    );
  });
});
