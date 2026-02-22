declare module 'react-native-notification-listener' {
  export interface NotificationPayload {
    app: string;           // 발신 앱 패키지명 e.g. "com.kakaobank.channel"
    title: string;
    titleBig: string;
    text: string;
    subText: string;
    summaryText: string;
    bigText: string;
    audioContentsURI: string;
    imageBackgroundURI: string;
    extraInfoText: string;
    groupedMessages: Array<{ title: string; text: string }>;
    icon: string;
    isClearable: boolean;
    ongoing: boolean;
    time: string;          // Unix ms as string
  }

  interface Subscription {
    remove(): void;
  }

  const NotificationListener: {
    requestPermission(): void;          // 설정 화면 열기 (런타임 다이얼로그 없음)
    isPermitted(): Promise<boolean>;
    startListening(): void;
    stopListening(): void;
    addListener(
      event: 'notificationReceived',
      callback: (notification: NotificationPayload) => void
    ): Subscription;
  };

  export default NotificationListener;
}
