import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

function computeIsOnline(s: NetInfoState): boolean {
  // type: 'none' = 활성 네트워크 인터페이스 없음 (에어플레인 모드, WiFi·데이터 모두 꺼짐)
  // Samsung Galaxy 등 isConnected/isInternetReachable을 잘못 보고하는 기기도
  // type은 'wifi' 또는 'cellular'로 올바르게 반환하므로 이 검사가 가장 신뢰성이 높다.
  return s.type !== 'none';
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
