// frontend/src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";
import { apiClient, saveToken, clearToken } from "../services/api";
import { createPlatformStorage } from "../storage";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
        } catch (err: any) {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            await clearToken();
            set({ user: null });
          }
          // 네트워크 에러: 기존 user 유지, isLoading만 해제
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "auth",
      storage: createPlatformStorage(),
      partialize: (state) => ({ user: state.user }), // isLoading 제외
    },
  ),
);
