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
    // TODO: GET /transactions/
    throw new Error("Not implemented");
  },

  createTransaction: async (data) => {
    // TODO: POST /transactions/
    throw new Error("Not implemented");
  },

  updateTransaction: async (id, data) => {
    // TODO: PUT /transactions/:id
    throw new Error("Not implemented");
  },

  deleteTransaction: async (id) => {
    // TODO: DELETE /transactions/:id
    throw new Error("Not implemented");
  },
}));
