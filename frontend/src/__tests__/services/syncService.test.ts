jest.mock('../../services/api', () => ({
  apiClient: { post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() },
}));
jest.mock('../../store/pendingMutationsStore', () => ({
  usePendingMutationsStore: { getState: jest.fn() },
}));
jest.mock('../../store/transactionStore', () => ({
  useTransactionStore: { getState: jest.fn(() => ({ replaceLocalTransaction: jest.fn() })) },
}));

import { apiClient } from '../../services/api';
import { usePendingMutationsStore } from '../../store/pendingMutationsStore';
import { useTransactionStore } from '../../store/transactionStore';
import { syncService } from '../../services/syncService';
import { PendingMutation } from '../../types';

const makeMut = (o: Partial<PendingMutation> = {}): PendingMutation => ({
  id: 'mut-1', type: 'CREATE', resource: 'transaction',
  payload: { type: 'expense', amount: 5000, transacted_at: '2026-01-15T12:00:00Z' },
  createdAt: Date.now(), ...o,
});

let mockDequeueMany: jest.Mock;
let mockReplace: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  syncService._resetFlushingState();
  mockDequeueMany = jest.fn();
  mockReplace = jest.fn();
  (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
    queue: [], dequeueMany: mockDequeueMany,
  });
  (useTransactionStore.getState as jest.Mock).mockReturnValue({
    replaceLocalTransaction: mockReplace,
  });
});

describe('syncService.flush', () => {
  it('does nothing when queue is empty', async () => {
    await syncService.flush();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(mockDequeueMany).not.toHaveBeenCalled();
  });

  it('processes CREATE and calls replaceLocalTransaction', async () => {
    const serverTx = { id: 'server-1', amount: 5000 };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: serverTx });
    (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
      queue: [makeMut({ localId: 'local-uuid' })], dequeueMany: mockDequeueMany,
    });
    await syncService.flush();
    expect(mockReplace).toHaveBeenCalledWith('local-uuid', serverTx);
    expect(mockDequeueMany).toHaveBeenCalledWith(['mut-1']);
  });

  it('processes UPDATE', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({ data: {} });
    (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
      queue: [makeMut({ type: 'UPDATE', payload: { id: 'tx-1', amount: 9000 } })],
      dequeueMany: mockDequeueMany,
    });
    await syncService.flush();
    expect(apiClient.put).toHaveBeenCalledWith('/transactions/tx-1', { amount: 9000 });
  });

  it('processes DELETE', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue({});
    (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
      queue: [makeMut({ type: 'DELETE', payload: { id: 'tx-1' } })],
      dequeueMany: mockDequeueMany,
    });
    await syncService.flush();
    expect(apiClient.delete).toHaveBeenCalledWith('/transactions/tx-1');
  });

  it('stops on failure and only dequeues succeeded', async () => {
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 'srv-1' } })
      .mockRejectedValueOnce(new Error('fail'));
    (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
      queue: [makeMut({ id: 'mut-1', localId: 'l1' }), makeMut({ id: 'mut-2', localId: 'l2' })],
      dequeueMany: mockDequeueMany,
    });
    await syncService.flush();
    expect(mockDequeueMany).toHaveBeenCalledWith(['mut-1']);
  });

  it('is not re-entrant', async () => {
    let resolve!: () => void;
    (apiClient.post as jest.Mock).mockReturnValue(
      new Promise<{ data: unknown }>((r) => { resolve = () => r({ data: { id: 'srv' } }); }),
    );
    (usePendingMutationsStore.getState as jest.Mock).mockReturnValue({
      queue: [makeMut({ localId: 'l1' })], dequeueMany: mockDequeueMany,
    });
    const first = syncService.flush();
    await syncService.flush(); // second call should be no-op
    resolve();
    await first;
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
});
