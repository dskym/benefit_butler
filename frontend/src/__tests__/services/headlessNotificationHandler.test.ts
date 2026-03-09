jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/smsParser', () => ({
  parseFinancialMessage: jest.fn(),
  buildDedupKey: jest.fn(),
}));

jest.mock('../../utils/financialAppPackages', () => ({
  FINANCIAL_APP_PACKAGES: ['com.kakaobank.channel', 'viva.republica.toss'],
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { parseFinancialMessage, buildDedupKey } = require('../../utils/smsParser');
const {
  headlessNotificationHandler,
  PENDING_PUSH_STORAGE_KEY,
} = require('../../services/headlessNotificationHandler');

function makeNotif(overrides: Partial<{
  app: string;
  title: string;
  text: string;
  bigText: string;
  time: string;
}> = {}): string {
  return JSON.stringify({
    app: 'com.kakaobank.channel',
    title: '결제 알림',
    text: '5,300원 스타벅스 결제 승인',
    bigText: '',
    time: '1736913000000',
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

describe('headlessNotificationHandler', () => {
  it('notifString이 undefined이면 AsyncStorage를 호출하지 않는다', async () => {
    await headlessNotificationHandler({ notification: undefined });

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('notifString이 빈 문자열이면 AsyncStorage를 호출하지 않는다', async () => {
    await headlessNotificationHandler({ notification: '' });

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('금융 앱이 아닌 패키지명이면 AsyncStorage에 기록하지 않는다', async () => {
    const notif = makeNotif({ app: 'com.some.random.app' });

    await headlessNotificationHandler({ notification: notif });

    expect(parseFinancialMessage).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('parseFinancialMessage가 null을 반환하면 AsyncStorage에 기록하지 않는다', async () => {
    parseFinancialMessage.mockReturnValue(null);

    await headlessNotificationHandler({ notification: makeNotif() });

    expect(parseFinancialMessage).toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('정상 파싱 결과를 빈 큐에 저장한다', async () => {
    const parsed = {
      amount: 5300,
      description: '스타벅스',
      type: 'expense' as const,
      transacted_at: '2025-01-15T04:30:00.000Z',
      payment_type: 'debit_card' as const,
    };
    parseFinancialMessage.mockReturnValue(parsed);
    buildDedupKey.mockReturnValue('5300:스타벅스:5789710');
    AsyncStorage.getItem.mockResolvedValue(null);

    await headlessNotificationHandler({ notification: makeNotif() });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PENDING_PUSH_STORAGE_KEY,
      JSON.stringify([{ ...parsed, dedupKey: '5300:스타벅스:5789710' }]),
    );
  });

  it('기존 큐에 새로운 항목을 추가한다', async () => {
    const existingItem = {
      amount: 10000,
      description: '이마트',
      type: 'expense',
      transacted_at: '2025-01-15T03:00:00.000Z',
      payment_type: 'bank',
      dedupKey: '10000:이마트:5789700',
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([existingItem]));

    const newParsed = {
      amount: 5300,
      description: '스타벅스',
      type: 'expense' as const,
      transacted_at: '2025-01-15T04:30:00.000Z',
      payment_type: 'debit_card' as const,
    };
    parseFinancialMessage.mockReturnValue(newParsed);
    buildDedupKey.mockReturnValue('5300:스타벅스:5789710');

    await headlessNotificationHandler({ notification: makeNotif() });

    const savedArg = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(savedArg).toHaveLength(2);
    expect(savedArg[0]).toEqual(existingItem);
    expect(savedArg[1]).toEqual({ ...newParsed, dedupKey: '5300:스타벅스:5789710' });
  });

  it('동일한 dedupKey가 이미 존재하면 중복 추가하지 않는다', async () => {
    const dedupKey = '5300:스타벅스:5789710';
    const existingItem = {
      amount: 5300,
      description: '스타벅스',
      type: 'expense',
      transacted_at: '2025-01-15T04:30:00.000Z',
      payment_type: 'debit_card',
      dedupKey,
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([existingItem]));

    parseFinancialMessage.mockReturnValue({
      amount: 5300,
      description: '스타벅스',
      type: 'expense',
      transacted_at: '2025-01-15T04:30:00.000Z',
      payment_type: 'debit_card',
    });
    buildDedupKey.mockReturnValue(dedupKey);

    await headlessNotificationHandler({ notification: makeNotif() });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('notifString이 유효하지 않은 JSON이면 예외 없이 무시한다', async () => {
    await expect(
      headlessNotificationHandler({ notification: '{not-valid-json' }),
    ).resolves.toBeUndefined();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('notification.time이 있으면 해당 값으로 타임스탬프를 사용하고, 없으면 Date.now()를 사용한다', async () => {
    const parsed = {
      amount: 5300,
      description: '스타벅스',
      type: 'expense' as const,
      transacted_at: '2025-01-15T04:30:00.000Z',
      payment_type: 'debit_card' as const,
    };
    parseFinancialMessage.mockReturnValue(parsed);
    buildDedupKey.mockReturnValue('key-with-time');

    // Case 1: notification.time이 명시적으로 제공된 경우
    const specificTime = '1736913000000';
    await headlessNotificationHandler({
      notification: makeNotif({ time: specificTime }),
    });

    expect(buildDedupKey).toHaveBeenCalledWith(5300, '스타벅스', 1736913000000);

    // Case 2: notification.time이 없는 경우 → Date.now() 사용
    jest.clearAllMocks();
    parseFinancialMessage.mockReturnValue(parsed);
    buildDedupKey.mockReturnValue('key-without-time');
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    await headlessNotificationHandler({
      notification: makeNotif({ time: '' }),
    });

    expect(buildDedupKey).toHaveBeenCalledWith(5300, '스타벅스', now);

    (Date.now as jest.Mock).mockRestore();
  });
});
