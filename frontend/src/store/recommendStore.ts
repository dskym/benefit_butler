// frontend/src/store/recommendStore.ts
import { create } from "zustand";
import { MerchantLookupResponse, RecommendItem, ResolvedMerchant } from "../types";
import { apiClient } from "../services/api";
import { BENEFIT_CATEGORIES } from "../utils/benefitCategories";

interface RecommendState {
  results: RecommendItem[];
  resolved: ResolvedMerchant | null;       // 마지막 lookup/추천의 가맹점 해석 결과
  availableCategories: string[];
  isLoading: boolean;
  isResolving: boolean;
  lastQuery: { merchantName: string; amount: number; category: string | null } | null;
  resolveMerchant: (query: string) => Promise<ResolvedMerchant | null>;
  recommend: (merchantName: string, amount: number, category: string | null) => Promise<void>;
  clear: () => void;
}

export const useRecommendStore = create<RecommendState>((set, get) => ({
  results: [],
  resolved: null,
  availableCategories: BENEFIT_CATEGORIES,
  isLoading: false,
  isResolving: false,
  lastQuery: null,

  // 가맹점명 자동 인식 (입력 디바운스 후 호출). 실패해도 조용히 무시.
  resolveMerchant: async (query) => {
    const q = query.trim();
    if (q.length < 2) {
      set({ resolved: null });
      return null;
    }
    set({ isResolving: true });
    try {
      const { data } = await apiClient.get<MerchantLookupResponse>("/merchants/lookup", {
        params: { q },
      });
      const resolved: ResolvedMerchant = {
        merchant_id: data.merchant_id,
        merchant_name: data.merchant_name,
        category: data.category,
        source: data.source,
        confidence: data.confidence,
      };
      set({
        resolved,
        availableCategories: data.available_categories?.length
          ? data.available_categories
          : BENEFIT_CATEGORIES,
      });
      return resolved;
    } catch {
      set({ resolved: null });
      return null;
    } finally {
      set({ isResolving: false });
    }
  },

  recommend: async (merchantName, amount, category) => {
    set({ isLoading: true });
    try {
      const body: Record<string, unknown> = { merchant_name: merchantName, amount };
      // 이미 해석된 가맹점이면 merchant_id를 전달해 서버 재해석 생략
      const resolved = get().resolved;
      if (resolved?.merchant_id) body.merchant_id = resolved.merchant_id;
      if (category !== null) body.category = category;
      const { data } = await apiClient.post("/cards/recommend", body);
      set({
        results: data.results,
        resolved: data.resolved ?? resolved,
        lastQuery: { merchantName, amount, category },
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clear: () => set({ results: [], resolved: null, lastQuery: null }),
}));
