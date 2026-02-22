declare module 'react-native-get-sms-android' {
  export interface SmsFilter {
    box?: 'inbox' | 'sent' | 'draft' | 'outbox' | 'failed' | 'queued' | '';
    minDate?: number;
    maxDate?: number;
    bodyRegex?: string;
    read?: 0 | 1;
    indexFrom?: number;
    maxCount?: number;
  }

  export interface RawSms {
    _id: string;
    thread_id: string;
    address: string;
    person: string | null;
    date: string;        // Unix ms as string
    date_sent: string;
    protocol: string | null;
    read: string;        // "0" | "1"
    status: string;
    type: string;
    subject: string | null;
    body: string;
    service_center: string | null;
    locked: string;
    error_code: string;
    seen: string;
  }

  const SmsAndroid: {
    list(
      filter: string,
      failureCallback: (error: string) => void,
      successCallback: (count: number, smsList: string) => void
    ): void;
  };

  export default SmsAndroid;
}
