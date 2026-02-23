import { useEffect } from 'react';
import { Platform, ToastAndroid, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFinancialImportStore } from '../store/financialImportStore';
import { useTransactionStore } from '../store/transactionStore';
import { useNetworkStatus } from './useNetworkStatus';
import { PENDING_PUSH_STORAGE_KEY } from '../services/headlessNotificationHandler';

interface PendingPushItem {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  transacted_at: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank' | 'cash';
  dedupKey: string;
}

export function usePushAutoImport() {
  const isPushEnabled = useFinancialImportStore((s) => s.isPushEnabled);
  const createTransaction = useTransactionStore((s) => s.createTransaction);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isPushEnabled) return;

    async function checkPermission() {
      const NL = require('react-native-notification-listener');
      const status: string = await NL.getPermissionStatus();
      if (status !== 'authorized') {
        NL.requestPermission();
      }
    }

    async function processPending() {
      const raw = await AsyncStorage.getItem(PENDING_PUSH_STORAGE_KEY);
      if (!raw) return;

      const pending: PendingPushItem[] = JSON.parse(raw);
      if (pending.length === 0) return;

      let addedCount = 0;
      const processedKeys: string[] = [];

      for (const item of pending) {
        if (useFinancialImportStore.getState().hasDedupSig(item.dedupKey)) {
          processedKeys.push(item.dedupKey);
          continue;
        }
        try {
          await createTransaction(
            {
              type: item.type,
              amount: item.amount,
              description: item.description,
              transacted_at: item.transacted_at,
              payment_type: item.payment_type,
            },
            isOnline
          );
          useFinancialImportStore.getState().markDedupSig(item.dedupKey);
          processedKeys.push(item.dedupKey);
          addedCount++;
        } catch (err) {
          console.warn('[PushAutoImport] 거래 추가 실패:', err);
        }
      }

      const remaining = pending.filter((item) => !processedKeys.includes(item.dedupKey));
      await AsyncStorage.setItem(PENDING_PUSH_STORAGE_KEY, JSON.stringify(remaining));

      if (addedCount > 0) {
        ToastAndroid.show(`알림에서 ${addedCount}건의 거래를 추가했습니다`, ToastAndroid.SHORT);
      }
    }

    checkPermission();
    processPending();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') processPending();
    });

    return () => sub.remove();
  }, [isPushEnabled]);
}
