// frontend/src/store/transactionStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Transaction } from "../types";
import { apiClient } from "../services/api";
import { createPlatformStorage } from "../storage";

interface TransactionCreate {
  type: "income" | "expense" | "transfer";
  amount: number;
  description?: string;
  category_id?: string;
  transacted_at: string;
  payment_type?: "cash" | "credit_card" | "debit_card" | "bank";
  user_card_id?: string;
}

interface TransactionUpdate {
  type?: "income" | "expense" | "transfer";
  amount?: number;
  description?: string;
  category_id?: string;
  transacted_at?: string;
  payment_type?: "cash" | "credit_card" | "debit_card" | "bank";
  user_card_id?: string;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  createTransaction: (data: TransactionCreate) => Promise<void>;
  updateTransaction: (id: string, data: TransactionUpdate) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  replaceLocalTransaction: (localId: string, serverTx: Transaction) => void;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set) => ({
      transactions: [],
      isLoading: false,

      fetchTransactions: async () => {
        set({ isLoading: true });
        try {
          const { data } = await apiClient.get("/transactions/");
          set({ transactions: data });
        } finally {
          set({ isLoading: false });
        }
      },

      createTransaction: async (payload) => {
        const { data } = await apiClient.post("/transactions/", payload);
        set((s) => ({ transactions: [data, ...s.transactions] }));
      },

      updateTransaction: async (id, payload) => {
        const { data } = await apiClient.put(`/transactions/${id}`, payload);
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? data : t)),
        }));
      },

      deleteTransaction: async (id) => {
        await apiClient.delete(`/transactions/${id}`);
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },

      toggleFavorite: async (id, isFavorite) => {
        const { data } = await apiClient.patch(`/transactions/${id}/favorite`, {
          is_favorite: isFavorite,
        });
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? data : t)),
        }));
      },

      replaceLocalTransaction: (localId, serverTx) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === localId ? serverTx : t)),
        })),
    }),
    { name: "transactions", storage: createPlatformStorage() },
  ),
);
