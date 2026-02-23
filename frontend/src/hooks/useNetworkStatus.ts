import { useState, useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
}

// Android는 앱 시작 시 네트워크 감지 전에 type:'none'을 잠깐 보고하는 경우가 있다.
// 오프라인 배너를 즉시 표시하지 않고 3초 대기 후 확정한다.
const OFFLINE_DEBOUNCE_MS = 3000;

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handle = (s: NetInfoState) => {
      if (computeIsOnline(s)) {
        // 온라인 복귀: 즉시 반영 + 대기 중인 오프라인 타이머 취소
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setStatus({ isOnline: true, isInternetReachable: s.isInternetReachable });
      } else {
        // 오프라인: 3초 후 확정 (Android 초기 false-positive 방지)
        if (!timerRef.current) {
          const captured = s;
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setStatus({ isOnline: false, isInternetReachable: captured.isInternetReachable });
          }, OFFLINE_DEBOUNCE_MS);
        }
      }
    };

    NetInfo.fetch().then(handle);
    const unsubscribe = NetInfo.addEventListener(handle);
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return status;
}
