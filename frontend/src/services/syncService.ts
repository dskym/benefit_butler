import { apiClient } from './api';
import { usePendingMutationsStore } from '../store/pendingMutationsStore';
import { useTransactionStore } from '../store/transactionStore';
import { PendingMutation } from '../types';

let _isFlushing = false;

export const syncService = {
  async flush(): Promise<void> {
    if (_isFlushing) return;
    _isFlushing = true;
    try {
      const { queue } = usePendingMutationsStore.getState();
      if (queue.length === 0) return;
      const flushed: string[] = [];
      for (const mutation of queue) {
        try {
          await processMutation(mutation);
          flushed.push(mutation.id);
        } catch (err) {
          console.warn('[sync] Failed, stopping flush', mutation, err);
          break;
        }
      }
      if (flushed.length > 0) {
        usePendingMutationsStore.getState().dequeueMany(flushed);
      }
    } finally {
      _isFlushing = false;
    }
  },
  _resetFlushingState() { _isFlushing = false; },
  get isFlushing() { return _isFlushing; },
};

async function processMutation(m: PendingMutation): Promise<void> {
  const p = m.payload as Record<string, unknown>;
  if (m.resource !== 'transaction') return;
  switch (m.type) {
    case 'CREATE': {
      const { data } = await apiClient.post('/transactions/', p);
      if (m.localId) useTransactionStore.getState().replaceLocalTransaction(m.localId, data);
      break;
    }
    case 'UPDATE': {
      const { id, ...body } = p as { id: string } & Record<string, unknown>;
      await apiClient.put(`/transactions/${id}`, body);
      break;
    }
    case 'DELETE': {
      await apiClient.delete(`/transactions/${(p as { id: string }).id}`);
      break;
    }
    case 'TOGGLE_FAVORITE': {
      const { id, is_favorite } = p as { id: string; is_favorite: boolean };
      await apiClient.patch(`/transactions/${id}/favorite`, { is_favorite });
      break;
    }
  }
}
