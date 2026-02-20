// frontend/src/store/cardStore.ts
import { create } from "zustand";
import { UserCard } from "../types";
import { apiClient } from "../services/api";

interface CardCreate {
  type: "credit_card" | "debit_card";
  name: string;
}

interface CardState {
  cards: UserCard[];
  isLoading: boolean;
  fetchCards: () => Promise<void>;
  createCard: (data: CardCreate) => Promise<UserCard>;
  deleteCard: (id: string) => Promise<void>;
}

export const useCardStore = create<CardState>((set) => ({
  cards: [],
  isLoading: false,

  fetchCards: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get("/cards/");
      set({ cards: data });
    } finally {
      set({ isLoading: false });
    }
  },

  createCard: async (payload) => {
    const { data } = await apiClient.post("/cards/", payload);
    set((s) => ({ cards: [...s.cards, data] }));
    return data;
  },

  deleteCard: async (id) => {
    await apiClient.delete(`/cards/${id}`);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },
}));
