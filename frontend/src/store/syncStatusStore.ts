import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPlatformStorage } from '../storage';

interface SyncStatusState {
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  setSyncing: (v: boolean) => void;
  setSyncComplete: () => void;
  setSyncError: (msg: string) => void;
}

export const useSyncStatusStore = create<SyncStatusState>()(
  persist(
    (set) => ({
      isSyncing: false,
      lastSyncAt: null,
      syncError: null,
      setSyncing: (v) => set({ isSyncing: v }),
      setSyncComplete: () => set({ isSyncing: false, lastSyncAt: Date.now(), syncError: null }),
      setSyncError: (msg) => set({ isSyncing: false, syncError: msg }),
    }),
    {
      name: 'sync-status',
      storage: createPlatformStorage(),
      partialize: (s) => ({ lastSyncAt: s.lastSyncAt }), // lastSyncAt만 영속
    },
  ),
);
