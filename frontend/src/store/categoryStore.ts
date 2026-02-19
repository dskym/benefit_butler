// frontend/src/store/categoryStore.ts
import { create } from "zustand";
import { Category } from "../types";
import { apiClient } from "../services/api";

interface CategoryCreate {
  name: string;
  type: "income" | "expense" | "transfer";
  color?: string;
}

interface CategoryUpdate {
  name?: string;
  type?: "income" | "expense" | "transfer";
  color?: string;
}

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (data: CategoryCreate) => Promise<void>;
  updateCategory: (id: string, data: CategoryUpdate) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get("/categories/");
      set({ categories: data });
    } finally {
      set({ isLoading: false });
    }
  },

  createCategory: async (payload) => {
    const { data } = await apiClient.post("/categories/", payload);
    set((s) => ({ categories: [data, ...s.categories] }));
  },

  updateCategory: async (id, payload) => {
    const { data } = await apiClient.put(`/categories/${id}`, payload);
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? data : c)),
    }));
  },

  deleteCategory: async (id) => {
    await apiClient.delete(`/categories/${id}`);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
}));
