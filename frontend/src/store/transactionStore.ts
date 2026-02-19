// frontend/src/store/transactionStore.ts
import { create } from "zustand";
import { Transaction } from "../types";
import { apiClient } from "../services/api";

interface TransactionCreate {
  type: "income" | "expense" | "transfer";
  amount: number;
  description?: string;
  category_id?: string;
  transacted_at: string;
}

interface TransactionUpdate {
  type?: "income" | "expense" | "transfer";
  amount?: number;
  description?: string;
  category_id?: string;
  transacted_at?: string;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  createTransaction: (data: TransactionCreate) => Promise<void>;
  updateTransaction: (id: string, data: TransactionUpdate) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set) => ({
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
}));
