// frontend/src/store/cardPerformanceStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CardPerformanceItem } from "../types";
import { apiClient } from "../services/api";
import { createPlatformStorage } from "../storage";

interface CardPerformanceState {
  performances: CardPerformanceItem[];
  isLoading: boolean;
  fetchPerformance: () => Promise<void>;
}

export const useCardPerformanceStore = create<CardPerformanceState>()(
  persist(
    (set) => ({
      performances: [],
      isLoading: false,

      fetchPerformance: async () => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.get("/cards/performance");
          set({ performances: data });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "card-performance-store",
      storage: createPlatformStorage(),
      partialize: (state) => ({ performances: state.performances }),
    }
  )
);
