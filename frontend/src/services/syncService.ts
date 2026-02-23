import { usePendingMutationsStore } from '../store/pendingMutationsStore';
import { useTransactionStore } from '../store/transactionStore';
import { useSyncStatusStore } from '../store/syncStatusStore';
import { apiClient } from './api';
import { PendingMutation } from '../types';

const MAX_RETRIES = 3;

function is4xx(err: any): boolean {
  const status = err?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

function isAuthError(err: any): boolean {
  const status = err?.response?.status;
  return status === 401 || status === 403;
}

async function processMutation(m: PendingMutation): Promise<void> {
  const { replaceLocalTransaction } = useTransactionStore.getState();
  const payload = m.payload as any;

  switch (m.type) {
    case 'CREATE': {
      const { data } = await apiClient.post('/transactions/', payload);
      if (m.localId) replaceLocalTransaction(m.localId, data);
      break;
    }
    case 'UPDATE': {
      const { id, ...body } = payload as { id: string } & Record<string, unknown>;
      await apiClient.put(`/transactions/${id}`, body);
      break;
    }
    case 'DELETE':
      await apiClient.delete(`/transactions/${payload.id}`);
      break;
    case 'TOGGLE_FAVORITE':
      await apiClient.patch(`/transactions/${payload.id}/favorite`, {
        is_favorite: payload.isFavorite,
      });
      break;
  }
}

export const syncService = {
  _isFlushing: false,

  async flush(): Promise<void> {
    const { queue, dequeue, incrementRetry } = usePendingMutationsStore.getState();
    if (queue.length === 0) return;
    if (this._isFlushing) return;

    this._isFlushing = true;
    const { setSyncing, setSyncComplete, setSyncError } = useSyncStatusStore.getState();
    setSyncing(true);

    try {
      // 큐 스냅샷 (flush 중 신규 enqueue 영향 없음)
      const snapshot = [...queue];
      for (const mutation of snapshot) {
        try {
          await processMutation(mutation);
          dequeue(mutation.id);
        } catch (err: any) {
          if (isAuthError(err)) {
            // 인증 오류: 전체 중단
            setSyncError('인증 오류 — 다시 로그인해주세요');
            return;
          }
          if (is4xx(err)) {
            // 4xx: 영구 실패, 큐에서 제거 후 계속
            console.warn('[sync] 영구 실패 (4xx), 건너뜀:', mutation, err);
            dequeue(mutation.id);
            continue;
          }
          // 5xx / 네트워크 오류
          if (mutation.retryCount >= MAX_RETRIES) {
            console.warn('[sync] 최대 재시도 초과, 건너뜀:', mutation, err);
            dequeue(mutation.id);
            continue;
          }
          incrementRetry(mutation.id);
          setSyncError('동기화 실패 — 연결 상태를 확인해주세요');
          return; // FIFO 순서 보장을 위해 중단
        }
      }
      setSyncComplete();
    } finally {
      this._isFlushing = false;
    }
  },
};
