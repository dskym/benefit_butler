// src/__tests__/services/api.test.ts
//
// Tests for token helper functions exported from api.ts.
// jest.mock() is hoisted above imports by Babel, so mocks are in place
// before api.ts loads and registers its interceptors.

import * as SecureStore from "expo-secure-store";
import { saveToken, clearToken, apiClient } from "../../services/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Force the native code path so tokenStorage uses SecureStore, not localStorage.
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},      // getApiBaseUrl()에서 SourceCode 자동감지 비활성화
}));

// Note: The 401 response interceptor uses dynamic import() for authStore,
// which is not fully supported in Jest VM. We test tokenStorage.delete only.

beforeEach(() => {
  jest.clearAllMocks();
});

describe("saveToken", () => {
  it("writes the token to SecureStore under the access_token key", async () => {
    await saveToken("my-jwt-token");

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "access_token",
      "my-jwt-token"
    );
  });
});

describe("clearToken", () => {
  it("removes the access_token key from SecureStore", async () => {
    await clearToken();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access_token");
  });
});

describe("apiClient config", () => {
  it("has timeout of 10000ms", () => {
    expect(apiClient.defaults.timeout).toBe(10000);
  });

  it("has a baseURL that ends with /api/v1", () => {
    expect(apiClient.defaults.baseURL).toMatch(/\/api\/v1$/);
  });
});

describe("request interceptor", () => {
  it("attaches Bearer header when token exists", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("test-jwt");
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    } as any);
    expect(config.headers.Authorization).toBe("Bearer test-jwt");
  });

  it("does not attach header when token is null", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    } as any);
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("response interceptor", () => {
  it("clears token on 401", async () => {
    const rejected = apiClient.interceptors.response.handlers[0].rejected;
    const error = { response: { status: 401 } };
    // The interceptor calls tokenStorage.delete (SecureStore.deleteItemAsync),
    // then attempts a dynamic import() for authStore which may fail in Jest VM.
    // We verify the token deletion occurs regardless.
    await expect(rejected(error)).rejects.toBeDefined();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access_token");
  });

  it("does not clear token on 500 error", async () => {
    jest.clearAllMocks();
    const rejected = apiClient.interceptors.response.handlers[0].rejected;
    const error = { response: { status: 500 } };
    await expect(rejected(error)).rejects.toEqual(error);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
