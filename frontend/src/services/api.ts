// frontend/src/services/api.ts
import axios from "axios";
import { Platform, NativeModules } from "react-native";
import * as SecureStore from "expo-secure-store";

// 우선순위: EXPO_PUBLIC_API_URL > Metro 호스트 자동감지 > localhost 폴백
// - EXPO_PUBLIC_API_URL: 명시적 설정 (프로덕션 빌드, 커스텀 서버)
// - Metro 자동감지: 개발 중 실기기/에뮬레이터에서 설정 없이 자동 연결
//   (같은 WiFi 네트워크에서 Metro 번들러 IP를 재사용)
// - localhost: iOS 시뮬레이터 / 웹 폴백
function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // __DEV__ + 네이티브: Metro scriptURL에서 호스트 IP 추출
  if (typeof __DEV__ !== "undefined" && __DEV__ && Platform.OS !== "web") {
    // NativeModules.SourceCode 는 테스트 환경에서 undefined일 수 있으므로 안전하게 접근
    const scriptURL: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (NativeModules as any)?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match?.[1]) return `http://${match[1]}:8000/api/v1`;
    }
  }
  return "http://localhost:8000/api/v1";
}

const BASE_URL = getApiBaseUrl();
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

export const apiClient = axios.create({ baseURL: BASE_URL, timeout: 10000 });

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
