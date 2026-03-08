// frontend/src/store/cardBenefitStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserCardBenefit } from "../types";
import { apiClient } from "../services/api";
import { createPlatformStorage } from "../storage";

interface BenefitCreate {
  category: string;
  benefit_type: "cashback" | "points" | "discount" | "free";
  rate?: number | null;
  flat_amount?: number | null;
  monthly_cap?: number | null;
  min_amount?: number | null;
}

interface BenefitUpdate {
  category?: string;
  benefit_type?: "cashback" | "points" | "discount" | "free";
  rate?: number | null;
  flat_amount?: number | null;
  monthly_cap?: number | null;
  min_amount?: number | null;
}

interface CardBenefitState {
  // benefits keyed by card_id
  benefits: Record<string, UserCardBenefit[]>;
  isLoading: boolean;
  fetchBenefits: (cardId: string) => Promise<void>;
  createBenefit: (cardId: string, data: BenefitCreate) => Promise<UserCardBenefit>;
  updateBenefit: (cardId: string, benefitId: string, data: BenefitUpdate) => Promise<void>;
  deleteBenefit: (cardId: string, benefitId: string) => Promise<void>;
}

export const useCardBenefitStore = create<CardBenefitState>()(
  persist(
    (set) => ({
      benefits: {},
      isLoading: false,

      fetchBenefits: async (cardId) => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.get(`/cards/${cardId}/benefits`);
          set((s) => ({ benefits: { ...s.benefits, [cardId]: data } }));
        } finally {
          set({ isLoading: false });
        }
      },

      createBenefit: async (cardId, payload) => {
        const { data } = await apiClient.post(`/cards/${cardId}/benefits`, payload);
        set((s) => ({
          benefits: {
            ...s.benefits,
            [cardId]: [...(s.benefits[cardId] ?? []), data],
          },
        }));
        return data;
      },

      updateBenefit: async (cardId, benefitId, payload) => {
        const { data } = await apiClient.patch(`/cards/${cardId}/benefits/${benefitId}`, payload);
        set((s) => ({
          benefits: {
            ...s.benefits,
            [cardId]: (s.benefits[cardId] ?? []).map((b) =>
              b.id === benefitId ? data : b
            ),
          },
        }));
      },

      deleteBenefit: async (cardId, benefitId) => {
        await apiClient.delete(`/cards/${cardId}/benefits/${benefitId}`);
        set((s) => ({
          benefits: {
            ...s.benefits,
            [cardId]: (s.benefits[cardId] ?? []).filter((b) => b.id !== benefitId),
          },
        }));
      },
    }),
    {
      name: "card-benefit-store",
      storage: createPlatformStorage(),
      partialize: (state) => ({ benefits: state.benefits }),
    }
  )
);
