// src/__tests__/services/api.test.ts
//
// Tests for token helper functions exported from api.ts.
// jest.mock() is hoisted above imports by Babel, so mocks are in place
// before api.ts loads and registers its interceptors.

import * as SecureStore from "expo-secure-store";
import { saveToken, clearToken } from "../../services/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Force the native code path so tokenStorage uses SecureStore, not localStorage.
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

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
