import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

jest.mock('@react-native-community/netinfo', () => ({
  configure: jest.fn(),
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

let capturedListener: ((s: any) => void) | null = null;

beforeEach(() => {
  capturedListener = null;
  jest.clearAllMocks();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
  (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
    capturedListener = cb;
    return jest.fn();
  });
});

describe('useNetworkStatus', () => {
  it('defaults to isOnline: true (optimistic)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('isInternetReachable: false이면 오프라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
  });

  it('isInternetReachable: true이면 온라인 (isConnected 무관)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('isInternetReachable: null이면 온라인 (HTTP 검사 대기 중, 낙관적 처리)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('isConnected: null, isInternetReachable: null이면 온라인 (낙관적)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: null, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('재연결 시 온라인으로 복귀', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
    act(() => { capturedListener?.({ isConnected: true, isInternetReachable: true }); });
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
