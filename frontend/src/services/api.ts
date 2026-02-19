// frontend/src/services/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

// iOS Simulator는 localhost 가능, Android 에뮬레이터는 10.0.2.2, 실기기는 실제 IP 필요
// .env.local 파일에 EXPO_PUBLIC_API_URL 설정 (예: http://192.168.x.x:8000/api/v1)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "access_token";

export const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor: JWT 자동 첨부
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 처리 → 토큰 제거 + 인증 상태 초기화
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      // 동적 import로 circular dependency 없이 스토어 상태 초기화
      const { useAuthStore } = await import("../store/authStore");
      useAuthStore.setState({ user: null });
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
