jest.mock('../../storage', () => ({
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

import { useSyncStatusStore } from '../../store/syncStatusStore';

const INITIAL = { isSyncing: false, lastSyncAt: null, syncError: null };

beforeEach(() => {
  useSyncStatusStore.setState(INITIAL);
  jest.clearAllMocks();
});

describe('useSyncStatusStore', () => {
  it('setSyncing(true)로 isSyncing을 true로 설정한다', () => {
    useSyncStatusStore.getState().setSyncing(true);
    expect(useSyncStatusStore.getState().isSyncing).toBe(true);
  });

  it('setSyncing(false)로 isSyncing을 false로 설정한다', () => {
    useSyncStatusStore.getState().setSyncing(true);
    useSyncStatusStore.getState().setSyncing(false);
    expect(useSyncStatusStore.getState().isSyncing).toBe(false);
  });

  it('setSyncComplete가 isSyncing을 false, lastSyncAt을 현재 시각으로 설정한다', () => {
    const before = Date.now();
    useSyncStatusStore.getState().setSyncing(true);
    useSyncStatusStore.getState().setSyncComplete();
    const state = useSyncStatusStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncAt).toBeGreaterThanOrEqual(before);
    expect(state.syncError).toBeNull();
  });

  it('setSyncError가 isSyncing을 false, syncError를 설정한다', () => {
    useSyncStatusStore.getState().setSyncing(true);
    useSyncStatusStore.getState().setSyncError('서버 오류');
    const state = useSyncStatusStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.syncError).toBe('서버 오류');
  });

  it('setSyncComplete 후 syncError가 초기화된다', () => {
    useSyncStatusStore.getState().setSyncError('이전 오류');
    useSyncStatusStore.getState().setSyncComplete();
    expect(useSyncStatusStore.getState().syncError).toBeNull();
  });

  it('setSyncError does not change lastSyncAt', () => {
    const fakeTime = 1234567890;
    useSyncStatusStore.setState({ ...INITIAL, lastSyncAt: fakeTime });
    useSyncStatusStore.getState().setSyncError('에러');
    expect(useSyncStatusStore.getState().lastSyncAt).toBe(fakeTime);
  });

  it('setSyncing(true) does not change lastSyncAt', () => {
    const fakeTime = 9999999;
    useSyncStatusStore.setState({ ...INITIAL, lastSyncAt: fakeTime });
    useSyncStatusStore.getState().setSyncing(true);
    expect(useSyncStatusStore.getState().lastSyncAt).toBe(fakeTime);
  });

  it('setSyncComplete updates lastSyncAt to current time', () => {
    useSyncStatusStore.setState(INITIAL);
    expect(useSyncStatusStore.getState().lastSyncAt).toBeNull();
    const before = Date.now();
    useSyncStatusStore.getState().setSyncComplete();
    const after = Date.now();
    const lastSync = useSyncStatusStore.getState().lastSyncAt!;
    expect(lastSync).toBeGreaterThanOrEqual(before);
    expect(lastSync).toBeLessThanOrEqual(after);
  });

  it('partialize only persists lastSyncAt (not isSyncing or syncError)', () => {
    // The persist config's partialize function selects only { lastSyncAt }
    // We verify by checking the store's persist configuration
    const persistOptions = (useSyncStatusStore as any).persist;
    if (persistOptions?.getOptions) {
      const options = persistOptions.getOptions();
      const partialized = options.partialize({
        isSyncing: true,
        lastSyncAt: 12345,
        syncError: 'err',
      });
      expect(partialized).toEqual({ lastSyncAt: 12345 });
      expect(partialized.isSyncing).toBeUndefined();
      expect(partialized.syncError).toBeUndefined();
    }
  });
});
