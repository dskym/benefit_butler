import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,           // optimistic: 첫 렌더 flash 방지
    isInternetReachable: null,
  });

  useEffect(() => {
    NetInfo.fetch().then((s: NetInfoState) =>
      setStatus({ isOnline: s.isConnected ?? false, isInternetReachable: s.isInternetReachable }),
    );
    const unsubscribe = NetInfo.addEventListener((s: NetInfoState) =>
      setStatus({ isOnline: s.isConnected ?? false, isInternetReachable: s.isInternetReachable }),
    );
    return unsubscribe;
  }, []);

  return status;
}
