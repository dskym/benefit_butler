// frontend/src/services/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = "http://localhost:8000/api/v1";
const TOKEN_KEY = "access_token";

export const apiClient = axios.create({ baseURL: BASE_URL });

// Request interceptor: JWT 자동 첨부
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: 401 처리
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      // TODO: navigate to login screen
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
