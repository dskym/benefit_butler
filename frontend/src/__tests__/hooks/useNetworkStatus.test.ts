import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

let capturedListener: ((s: any) => void) | null = null;

beforeEach(() => {
  capturedListener = null;
  jest.clearAllMocks();
  jest.useFakeTimers();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ type: 'wifi', isConnected: true, isInternetReachable: true });
  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
    capturedListener = cb;
    return jest.fn();
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useNetworkStatus', () => {
  it('defaults to isOnline: true (optimistic)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('type: none이면 3초 디바운스 후 오프라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    // 디바운스 대기 중 — 아직 온라인
    expect(result.current.isOnline).toBe(true);
    // 3초 경과 → 오프라인 확정
    act(() => { jest.advanceTimersByTime(3000); });
    expect(result.current.isOnline).toBe(false);
  });

  it('3초 미만 단절은 오프라인으로 처리하지 않는다 (Android 초기 false-positive 방지)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    act(() => { jest.advanceTimersByTime(2999); });
    expect(result.current.isOnline).toBe(true);
  });

  it('type: wifi이면 즉시 온라인 (isConnected 무관)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'wifi', isConnected: false, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('type: cellular이면 즉시 온라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'cellular', isConnected: true, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('type: unknown이면 즉시 온라인 (낙관적)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'unknown', isConnected: null, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('Samsung Galaxy처럼 isConnected:false여도 type:wifi면 즉시 온라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'wifi', isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('오프라인 확정 전 재연결 시 디바운스가 취소되고 즉시 온라인 유지', () => {
    const { result } = renderHook(() => useNetworkStatus());
    // 오프라인 이벤트 (디바운스 시작)
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(true); // 아직 디바운스 중
    // 3초 이전에 재연결 → 디바운스 타이머 취소
    act(() => { capturedListener?.({ type: 'wifi', isConnected: true, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
    // 3초 경과해도 오프라인으로 바뀌지 않음
    act(() => { jest.advanceTimersByTime(3000); });
    expect(result.current.isOnline).toBe(true);
  });

  it('재연결 시 온라인으로 복귀 (오프라인 확정 이후)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    // 오프라인 확정
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(result.current.isOnline).toBe(false);
    // 재연결 → 즉시 온라인
    act(() => { capturedListener?.({ type: 'wifi', isConnected: true, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('unsubscribes on unmount', () => {
    const mockUnsub = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsub);
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
