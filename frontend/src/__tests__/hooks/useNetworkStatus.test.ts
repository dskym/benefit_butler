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
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ type: 'wifi', isConnected: true, isInternetReachable: true });
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

  it('type: none이면 오프라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
  });

  it('type: wifi이면 온라인 (isConnected 무관)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'wifi', isConnected: false, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('type: cellular이면 온라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'cellular', isConnected: true, isInternetReachable: true }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('type: unknown이면 온라인 (낙관적)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'unknown', isConnected: null, isInternetReachable: null }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('Samsung Galaxy처럼 isConnected:false여도 type:wifi면 온라인', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'wifi', isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(true);
  });

  it('재연결 시 온라인으로 복귀', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => { capturedListener?.({ type: 'none', isConnected: false, isInternetReachable: false }); });
    expect(result.current.isOnline).toBe(false);
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
