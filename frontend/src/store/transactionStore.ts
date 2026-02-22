// frontend/src/store/transactionStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Transaction } from "../types";
import { apiClient } from "../services/api";
import { createPlatformStorage } from "../storage";
import { usePendingMutationsStore } from "./pendingMutationsStore";

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
  createTransaction: (data: TransactionCreate, isOnline?: boolean) => Promise<void>;
  updateTransaction: (id: string, data: TransactionUpdate, isOnline?: boolean) => Promise<void>;
  deleteTransaction: (id: string, isOnline?: boolean) => Promise<void>;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  replaceLocalTransaction: (localId: string, serverTx: Transaction) => void;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
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

      createTransaction: async (payload, isOnline = true) => {
        if (!isOnline) {
          const localId = generateId();
          const optimistic: Transaction = {
            id: localId,
            user_id: '',
            category_id: payload.category_id ?? null,
            type: payload.type,
            amount: payload.amount,
            description: payload.description ?? null,
            transacted_at: payload.transacted_at,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            payment_type: payload.payment_type ?? null,
            user_card_id: payload.user_card_id ?? null,
            is_favorite: false,
            _isPending: true,
          };
          set((s) => ({ transactions: [optimistic, ...s.transactions] }));
          usePendingMutationsStore.getState().enqueue({
            type: 'CREATE',
            resource: 'transaction',
            payload,
            localId,
          });
          return;
        }
        const { data } = await apiClient.post("/transactions/", payload);
        set((s) => ({ transactions: [data, ...s.transactions] }));
      },

      updateTransaction: async (id, payload, isOnline = true) => {
        if (!isOnline) {
          set((s) => ({
            transactions: s.transactions.map((t) =>
              t.id === id
                ? { ...t, ...payload, updated_at: new Date().toISOString() }
                : t,
            ),
          }));
          usePendingMutationsStore.getState().enqueue({
            type: 'UPDATE',
            resource: 'transaction',
            payload: { id, ...payload },
          });
          return;
        }
        const { data } = await apiClient.put(`/transactions/${id}`, payload);
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? data : t)),
        }));
      },

      deleteTransaction: async (id, isOnline = true) => {
        if (!isOnline) {
          set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
          usePendingMutationsStore.getState().enqueue({
            type: 'DELETE',
            resource: 'transaction',
            payload: { id },
          });
          return;
        }
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
