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
    // TODO: GET /categories/
    throw new Error("Not implemented");
  },

  createCategory: async (data) => {
    // TODO: POST /categories/
    throw new Error("Not implemented");
  },

  updateCategory: async (id, data) => {
    // TODO: PUT /categories/:id
    throw new Error("Not implemented");
  },

  deleteCategory: async (id) => {
    // TODO: DELETE /categories/:id
    throw new Error("Not implemented");
  },
}));
