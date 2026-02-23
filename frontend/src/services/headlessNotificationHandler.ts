import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseFinancialMessage, buildDedupKey } from '../utils/smsParser';
import { FINANCIAL_APP_PACKAGES } from '../utils/financialAppPackages';

export const PENDING_PUSH_STORAGE_KEY = '@benefit_butler/pending_push';

interface PendingPushItem {
  amount: number;
  description: string;
  type: 'income' | 'expense';
  transacted_at: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank' | 'cash';
  dedupKey: string;
}

// Headless JS 컨텍스트에서 실행 — React 상태 접근 불가
// 알림 파싱 후 AsyncStorage에 저장, 앱 포어그라운드 복귀 시 usePushAutoImport가 처리
export const headlessNotificationHandler = async ({
  notification: notifString,
}: {
  notification?: string;
}) => {
  if (!notifString) return;

  try {
    const notification = JSON.parse(notifString) as {
      app: string;
      title: string;
      text: string;
      bigText: string;
      time: string;
    };

    if (!FINANCIAL_APP_PACKAGES.includes(notification.app as any)) return;

    const text = [notification.title, notification.text, notification.bigText]
      .filter(Boolean)
      .join(' ');

    const parsed = parseFinancialMessage(text, 'push', notification.app);
    if (!parsed) return;

    const tsMs = Number(notification.time) || Date.now();
    const dedupKey = buildDedupKey(parsed.amount, parsed.description, tsMs);

    const existingRaw = await AsyncStorage.getItem(PENDING_PUSH_STORAGE_KEY);
    const existing: PendingPushItem[] = existingRaw ? JSON.parse(existingRaw) : [];

    if (existing.some((item) => item.dedupKey === dedupKey)) return;

    existing.push({ ...parsed, dedupKey });
    await AsyncStorage.setItem(PENDING_PUSH_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // headless 컨텍스트 — 에러 무시
  }
};
