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

  it('updates when disconnected', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
  });

  it('updates when reconnected', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: false }); });
    act(() => { capturedListener?.({ isConnected: true, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('treats isConnected: null as online (Android 전환 상태 대응)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: null, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('isInternetReachable: true가 isConnected: false보다 우선한다 (Galaxy NET_CAPABILITY_VALIDATED 오보 대응)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: false, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('isInternetReachable: false가 isConnected: true보다 우선한다', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ isConnected: true, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const mockUnsub = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsub);
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
