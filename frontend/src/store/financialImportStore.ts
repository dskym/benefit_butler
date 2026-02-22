import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPlatformStorage } from '../storage';

const MAX_SMS_IDS = 1000;
const MAX_DEDUP_SIGS = 3000;

interface FinancialImportState {
  isSmsEnabled: boolean;
  isPushEnabled: boolean;
  importedSmsIds: string[];
  dedupSignatures: string[];
  lastSmsImportDate: number | null;
  isImporting: boolean;
  setSmsEnabled: (v: boolean) => void;
  setPushEnabled: (v: boolean) => void;
  markSmsImportedBatch: (ids: string[]) => void;
  isSmsAlreadyImported: (id: string) => boolean;
  markDedupSig: (key: string) => void;
  hasDedupSig: (key: string) => boolean;
  setLastSmsImportDate: (ts: number) => void;
  setImporting: (v: boolean) => void;
}

export const useFinancialImportStore = create<FinancialImportState>()(
  persist(
    (set, get) => ({
      isSmsEnabled: false,
      isPushEnabled: false,
      importedSmsIds: [],
      dedupSignatures: [],
      lastSmsImportDate: null,
      isImporting: false,
      setSmsEnabled: (v) => set({ isSmsEnabled: v }),
      setPushEnabled: (v) => set({ isPushEnabled: v }),
      markSmsImportedBatch: (ids) =>
        set((s) => {
          const merged = [...new Set([...s.importedSmsIds, ...ids])];
          return {
            importedSmsIds:
              merged.length > MAX_SMS_IDS ? merged.slice(merged.length - MAX_SMS_IDS) : merged,
          };
        }),
      isSmsAlreadyImported: (id) => get().importedSmsIds.includes(id),
      markDedupSig: (key) =>
        set((s) => {
          if (s.dedupSignatures.includes(key)) return s;
          const next = [...s.dedupSignatures, key];
          return {
            dedupSignatures:
              next.length > MAX_DEDUP_SIGS ? next.slice(next.length - MAX_DEDUP_SIGS) : next,
          };
        }),
      hasDedupSig: (key) => get().dedupSignatures.includes(key),
      setLastSmsImportDate: (ts) => set({ lastSmsImportDate: ts }),
      setImporting: (v) => set({ isImporting: v }),
    }),
    {
      name: 'financial-import',
      storage: createPlatformStorage(),
      partialize: (s) => ({
        isSmsEnabled: s.isSmsEnabled,
        isPushEnabled: s.isPushEnabled,
        importedSmsIds: s.importedSmsIds,
        dedupSignatures: s.dedupSignatures,
        lastSmsImportDate: s.lastSmsImportDate,
      }),
    }
  )
);
