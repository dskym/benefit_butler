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

  it('unsubscribes on unmount', () => {
    const mockUnsub = jest.fn();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsub);
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
