// frontend/src/store/recommendStore.ts
import { create } from "zustand";
import { RecommendResult } from "../types";
import { apiClient } from "../services/api";

interface RecommendState {
  results: RecommendResult[];
  isLoading: boolean;
  lastQuery: { merchantName: string; amount: number; category: string | null } | null;
  recommend: (merchantName: string, amount: number, category: string | null) => Promise<void>;
  clear: () => void;
}

export const useRecommendStore = create<RecommendState>((set) => ({
  results: [],
  isLoading: false,
  lastQuery: null,

  recommend: async (merchantName, amount, category) => {
    set({ isLoading: true });
    try {
      const body: Record<string, unknown> = { merchant_name: merchantName, amount };
      if (category !== null) body.category = category;
      const { data } = await apiClient.post("/cards/recommend", body);
      set({
        results: data,
        lastQuery: { merchantName, amount, category },
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clear: () => set({ results: [], lastQuery: null }),
}));
