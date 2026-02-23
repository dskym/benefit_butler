import { useEffect } from 'react';
import { Platform, PermissionsAndroid, ToastAndroid } from 'react-native';
import { useFinancialImportStore } from '../store/financialImportStore';
import { useTransactionStore } from '../store/transactionStore';
import { useNetworkStatus } from './useNetworkStatus';
import { parseFinancialMessage, buildDedupKey } from '../utils/smsParser';

interface RawSmsItem {
  _id: string;
  address: string;
  body: string;
  date: string;
}

const INITIAL_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const BUFFER_MS = 24 * 60 * 60 * 1000;

async function requestSmsPermission(): Promise<boolean> {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS 읽기 권한',
        message: '금융 SMS를 자동으로 파싱하여 거래를 추가하기 위해 SMS 읽기 권한이 필요합니다.',
        buttonPositive: '허용',
        buttonNegative: '거부',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function readSmsInbox(minDate: number): Promise<RawSmsItem[]> {
  return new Promise((resolve) => {
    const SmsAndroid = require('react-native-get-sms-android');
    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', minDate, maxCount: 500, indexFrom: 0 }),
      () => resolve([]),
      (_count: number, smsList: string) => {
        try { resolve(JSON.parse(smsList) as RawSmsItem[]); }
        catch { resolve([]); }
      }
    );
  });
}

export function useSmsAutoImport() {
  const isSmsEnabled = useFinancialImportStore((s) => s.isSmsEnabled);
  const lastSmsImportDate = useFinancialImportStore((s) => s.lastSmsImportDate);
  const createTransaction = useTransactionStore((s) => s.createTransaction);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!isSmsEnabled) return;

    async function runImport() {
      const hasPerm = await requestSmsPermission();
      if (!hasPerm) return;

      useFinancialImportStore.getState().setImporting(true);
      try {
        const minDate = lastSmsImportDate
          ? lastSmsImportDate - BUFFER_MS
          : Date.now() - INITIAL_LOOKBACK_MS;

        const smsList = await readSmsInbox(minDate);
        if (smsList.length === 0) return;

        const newSmsIds: string[] = [];
        let addedCount = 0;

        for (const sms of smsList) {
          if (useFinancialImportStore.getState().isSmsAlreadyImported(sms._id)) continue;
          const parsed = parseFinancialMessage(sms.body, 'sms', sms.address);
          if (!parsed) continue;

          const tsMs = Number(sms.date) || Date.now();
          const dedupKey = buildDedupKey(parsed.amount, parsed.description, tsMs);
          newSmsIds.push(sms._id);

          if (useFinancialImportStore.getState().hasDedupSig(dedupKey)) {
            // 이미 푸시 등으로 추가됨 — SMS ID만 기록
            continue;
          }

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
          addedCount++;
        }

        if (newSmsIds.length > 0) {
          useFinancialImportStore.getState().markSmsImportedBatch(newSmsIds);
          useFinancialImportStore.getState().setLastSmsImportDate(Date.now());
        }
        if (addedCount > 0) {
          ToastAndroid.show(`SMS에서 ${addedCount}건의 거래를 추가했습니다`, ToastAndroid.SHORT);
        }
      } catch (err) {
        console.warn('[SmsAutoImport] 임포트 실패', err);
      } finally {
        useFinancialImportStore.getState().setImporting(false);
      }
    }

    runImport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSmsEnabled]);
}
