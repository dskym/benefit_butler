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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      await saveToken(data.access_token);
      const { data: user } = await apiClient.get("/auth/me");
      set({ user });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      await apiClient.post("/auth/register", { email, password, name });
      await get().login(email, password);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.get("/auth/me");
      set({ user: data });
    } catch {
      await clearToken();
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
