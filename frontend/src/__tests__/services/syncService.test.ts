jest.mock('../../services/api', () => ({
  apiClient: { post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));
jest.mock('../../store/pendingMutationsStore', () => ({
  usePendingMutationsStore: { getState: jest.fn() },
}));
jest.mock('../../store/transactionStore', () => ({
  useTransactionStore: { getState: jest.fn() },
}));
jest.mock('../../store/syncStatusStore', () => ({
  useSyncStatusStore: { getState: jest.fn() },
}));

import { apiClient } from '../../services/api';
import { usePendingMutationsStore } from '../../store/pendingMutationsStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useSyncStatusStore } from '../../store/syncStatusStore';
import { syncService } from '../../services/syncService';

function makeMutation(overrides = {}) {
  return {
    id: 'mut-1',
    type: 'CREATE' as const,
    resource: 'transaction' as const,
    payload: {
      type: 'expense',
      amount: 5000,
      description: '테스트',
      transacted_at: new Date().toISOString(),
      payment_type: 'cash',
    },
    localId: 'local-1',
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

let mockDequeue: jest.Mock;
let mockDequeueMany: jest.Mock;
let mockIncrementRetry: jest.Mock;
let mockReplaceLocal: jest.Mock;
let mockSetSyncing: jest.Mock;
let mockSetSyncComplete: jest.Mock;
let mockSetSyncError: jest.Mock;

function setupMocks(queue: ReturnType<typeof makeMutation>[]) {
  (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
    queue,
    dequeue: mockDequeue,
    dequeueMany: mockDequeueMany,
    incrementRetry: mockIncrementRetry,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  syncService['_isFlushing'] = false;

  mockDequeue = jest.fn();
  mockDequeueMany = jest.fn();
  mockIncrementRetry = jest.fn();
  mockReplaceLocal = jest.fn();
  mockSetSyncing = jest.fn();
  mockSetSyncComplete = jest.fn();
  mockSetSyncError = jest.fn();

  setupMocks([]);
  (useTransactionStore.getState as jest.Mock).mockReturnValue({
    replaceLocalTransaction: mockReplaceLocal,
  });
  (useSyncStatusStore.getState as jest.Mock).mockReturnValue({
    setSyncing: mockSetSyncing,
    setSyncComplete: mockSetSyncComplete,
    setSyncError: mockSetSyncError,
  });
});

describe('syncService.flush', () => {
  it('빈 큐에서 setSyncing을 호출하지 않는다', async () => {
    await syncService.flush();
    expect(mockSetSyncing).not.toHaveBeenCalled();
  });

  it('CREATE 성공 시 dequeue + replaceLocalTransaction + setSyncComplete 호출', async () => {
    const mut = makeMutation();
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'server-1' } });
    await syncService.flush();
    expect(mockDequeue).toHaveBeenCalledWith('mut-1');
    expect(mockReplaceLocal).toHaveBeenCalledWith('local-1', { id: 'server-1' });
    expect(mockSetSyncComplete).toHaveBeenCalled();
  });

  it('4xx 오류 시 즉시 dequeue (영구 실패)', async () => {
    const mut = makeMutation();
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockRejectedValue({ response: { status: 404 } });
    await syncService.flush();
    expect(mockDequeue).toHaveBeenCalledWith('mut-1');
    expect(mockIncrementRetry).not.toHaveBeenCalled();
  });

  it('5xx 오류 + retryCount < 3이면 incrementRetry 후 flush 중단', async () => {
    const mut = makeMutation({ retryCount: 1 });
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    await syncService.flush();
    expect(mockIncrementRetry).toHaveBeenCalledWith('mut-1');
    expect(mockDequeue).not.toHaveBeenCalled();
    expect(mockSetSyncError).toHaveBeenCalled();
  });

  it('5xx 오류 + retryCount >= 3이면 dequeue (영구 포기)', async () => {
    const mut = makeMutation({ retryCount: 3 });
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    await syncService.flush();
    expect(mockDequeue).toHaveBeenCalledWith('mut-1');
  });

  it('re-entrancy guard: 동시에 두 번 flush 호출 시 한 번만 실행', async () => {
    const mut = makeMutation();
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'server-1' } });
    const p1 = syncService.flush();
    const p2 = syncService.flush();
    await Promise.all([p1, p2]);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('UPDATE 성공 시 dequeue 호출', async () => {
    const mut = makeMutation({ type: 'UPDATE', payload: { id: 'tx-1', amount: 3000 } });
    setupMocks([mut]);
    (apiClient.put as jest.Mock).mockResolvedValue({ data: {} });
    await syncService.flush();
    expect(apiClient.put).toHaveBeenCalledWith('/transactions/tx-1', expect.any(Object));
    expect(mockDequeue).toHaveBeenCalledWith('mut-1');
  });

  it('DELETE 성공 시 dequeue 호출', async () => {
    const mut = makeMutation({ type: 'DELETE', payload: { id: 'tx-1' } });
    setupMocks([mut]);
    (apiClient.delete as jest.Mock).mockResolvedValue({});
    await syncService.flush();
    expect(apiClient.delete).toHaveBeenCalledWith('/transactions/tx-1');
    expect(mockDequeue).toHaveBeenCalledWith('mut-1');
  });

  it('setSyncing(true) 후 setSyncComplete 순서 보장', async () => {
    const mut = makeMutation();
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'server-1' } });
    const calls: string[] = [];
    mockSetSyncing.mockImplementation(() => calls.push('setSyncing'));
    mockSetSyncComplete.mockImplementation(() => calls.push('setSyncComplete'));
    await syncService.flush();
    expect(calls).toEqual(['setSyncing', 'setSyncComplete']);
  });

  it('401/403 오류 시 setSyncError를 호출하고 flush 중단', async () => {
    const mut = makeMutation();
    setupMocks([mut]);
    (apiClient.post as jest.Mock).mockRejectedValue({ response: { status: 401 } });
    await syncService.flush();
    expect(mockSetSyncError).toHaveBeenCalled();
    expect(mockDequeue).not.toHaveBeenCalled();
    expect(mockIncrementRetry).not.toHaveBeenCalled();
  });
});
