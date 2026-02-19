// frontend/src/services/api.ts
import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// iOS Simulator는 localhost 가능, Android 에뮬레이터는 10.0.2.2, 실기기는 실제 IP 필요
// .env.local 파일에 EXPO_PUBLIC_API_URL 설정 (예: http://192.168.x.x:8000/api/v1)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "access_token";

// expo-secure-store는 웹에서 빈 객체를 반환해 모든 메서드가 undefined임.
// 웹에서는 localStorage로 fallback.
const tokenStorage = {
  get: (key: string): Promise<string | null> =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),

  set: (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },

  delete: (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor: JWT 자동 첨부
apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 처리 → 토큰 제거 + 인증 상태 초기화
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.delete(TOKEN_KEY);
      const { useAuthStore } = await import("../store/authStore");
      useAuthStore.setState({ user: null });
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token: string) => tokenStorage.set(TOKEN_KEY, token);
export const clearToken = () => tokenStorage.delete(TOKEN_KEY);
