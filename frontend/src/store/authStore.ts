// frontend/src/store/authStore.ts
import { create } from "zustand";
import { User } from "../types";
import { apiClient, saveToken, clearToken } from "../services/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email, password) => {
    // TODO: POST /auth/login → saveToken → fetchMe
    throw new Error("Not implemented");
  },

  register: async (email, password, name) => {
    // TODO: POST /auth/register
    throw new Error("Not implemented");
  },

  logout: async () => {
    // TODO: clearToken → set({ user: null })
    throw new Error("Not implemented");
  },

  fetchMe: async () => {
    // TODO: GET /auth/me → set({ user })
    throw new Error("Not implemented");
  },
}));
