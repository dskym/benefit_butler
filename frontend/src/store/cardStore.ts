// frontend/src/store/cardStore.ts
import { create } from "zustand";
import { CardCatalog, UserCard } from "../types";
import { apiClient } from "../services/api";

interface CardCreate {
  type: "credit_card" | "debit_card";
  name: string;
  monthly_target?: number | null;
  billing_day?: number | null;
  catalog_id?: string | null; // 지정 시 카탈로그 혜택 자동 복사
}

interface CardPatch {
  monthly_target?: number | null;
  billing_day?: number | null;
  catalog_id?: string | null; // 변경 시 기존 혜택 삭제 후 재복사 (파괴적 — UI에서 확인)
}

interface CardState {
  cards: UserCard[];
  catalogResults: CardCatalog[];
  isLoading: boolean;
  isSearchingCatalog: boolean;
  fetchCards: () => Promise<void>;
  searchCatalog: (query: string) => Promise<void>;
  clearCatalogResults: () => void;
  createCard: (data: CardCreate) => Promise<UserCard>;
  updateCard: (id: string, patch: CardPatch) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
}

export const useCardStore = create<CardState>((set) => ({
  cards: [],
  catalogResults: [],
  isLoading: false,
  isSearchingCatalog: false,

  fetchCards: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get("/cards/");
      set({ cards: data });
    } finally {
      set({ isLoading: false });
    }
  },

  searchCatalog: async (query) => {
    const q = query.trim();
    if (q.length < 1) {
      set({ catalogResults: [] });
      return;
    }
    set({ isSearchingCatalog: true });
    try {
      const { data } = await apiClient.get("/cards/catalog/", { params: { q } });
      set({ catalogResults: data });
    } catch {
      set({ catalogResults: [] });
    } finally {
      set({ isSearchingCatalog: false });
    }
  },

  clearCatalogResults: () => set({ catalogResults: [] }),

  createCard: async (payload) => {
    const { data } = await apiClient.post("/cards/", payload);
    set((s) => ({ cards: [...s.cards, data] }));
    return data;
  },

  updateCard: async (id, patch) => {
    const { data } = await apiClient.patch(`/cards/${id}`, patch);
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? data : c)) }));
  },

  deleteCard: async (id) => {
    await apiClient.delete(`/cards/${id}`);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },
}));
