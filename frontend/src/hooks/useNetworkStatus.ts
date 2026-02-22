import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

// Android: Samsung 등 일부 기기에서 NET_CAPABILITY_VALIDATED가 잘못 보고될 때를 위해
// HTTP 수준 도달 가능성 검사 활성화 (isInternetReachable이 실제 HTTP 요청 기반으로 결정됨)
if (Platform.OS === 'android') {
  NetInfo.configure({
    reachabilityUrl: 'https://clients3.google.com/generate_204',
    reachabilityTest: async (response) => response.status === 204,
    reachabilityShortTimeout: 5_000,
    reachabilityLongTimeout: 60_000,
    reachabilityRequestTimeout: 15_000,
    reachabilityMethod: 'HEAD',
  });
}

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

function computeIsOnline(s: NetInfoState): boolean {
  // isInternetReachable이 HTTP 수준에서 확인된 값이면 우선 사용
  if (s.isInternetReachable !== null) return s.isInternetReachable;
  // null(아직 미확인)인 경우 isConnected로 낙관적 판단 (null은 온라인으로 처리)
  return s.isConnected !== false;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,           // optimistic: 첫 렌더 flash 방지
    isInternetReachable: null,
  });

  useEffect(() => {
    NetInfo.fetch().then((s: NetInfoState) =>
      setStatus({ isOnline: computeIsOnline(s), isInternetReachable: s.isInternetReachable }),
    );
    const unsubscribe = NetInfo.addEventListener((s: NetInfoState) =>
      setStatus({ isOnline: computeIsOnline(s), isInternetReachable: s.isInternetReachable }),
    );
    return unsubscribe;
  }, []);

  return status;
}
