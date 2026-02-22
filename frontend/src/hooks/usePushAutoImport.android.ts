import { useEffect } from 'react';
import { Platform, ToastAndroid } from 'react-native';
import { useFinancialImportStore } from '../store/financialImportStore';
import { useTransactionStore } from '../store/transactionStore';
import { useNetworkStatus } from './useNetworkStatus';
import { parseFinancialMessage, buildDedupKey } from '../utils/smsParser';
import { FINANCIAL_APP_PACKAGES } from '../utils/financialAppPackages';

export function usePushAutoImport() {
  const isPushEnabled = useFinancialImportStore((s) => s.isPushEnabled);
  const createTransaction = useTransactionStore((s) => s.createTransaction);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isPushEnabled) return;

    let subscription: { remove: () => void } | null = null;

    async function start() {
      const NL = require('react-native-notification-listener').default;
      const permitted: boolean = await NL.isPermitted();
      if (!permitted) return;

      NL.startListening();
      subscription = NL.addListener(
        'notificationReceived',
        async (notification: { app: string; title: string; text: string; bigText: string; time: string }) => {
          if (!FINANCIAL_APP_PACKAGES.includes(notification.app as any)) return;

          const text = [notification.title, notification.text, notification.bigText]
            .filter(Boolean)
            .join(' ');

          const parsed = parseFinancialMessage(text, 'push', notification.app);
          if (!parsed) return;

          const tsMs = Number(notification.time) || Date.now();
          const dedupKey = buildDedupKey(parsed.amount, parsed.description, tsMs);

          if (useFinancialImportStore.getState().hasDedupSig(dedupKey)) return;

          try {
            await createTransaction(
              {
                type: parsed.type,
                amount: parsed.amount,
                description: parsed.description,
                transacted_at: parsed.transacted_at,
                payment_type: parsed.payment_type,
              },
              isOnline
            );
            useFinancialImportStore.getState().markDedupSig(dedupKey);
            ToastAndroid.show(
              `거래 추가: ${parsed.description} ${parsed.amount.toLocaleString()}원`,
              ToastAndroid.SHORT
            );
          } catch (err) {
            console.warn('[PushAutoImport] 거래 추가 실패', err);
          }
        }
      );
    }

    start();

    return () => {
      subscription?.remove();
    };
  }, [isPushEnabled]);
}
