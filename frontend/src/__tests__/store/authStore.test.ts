// src/__tests__/store/authStore.test.ts

import { useAuthStore } from "../../store/authStore";
import { apiClient, saveToken, clearToken } from "../../services/api";

// Mock the entire api module so network calls are never made.
jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  saveToken: jest.fn(),
  clearToken: jest.fn(),
}));

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  // Reset store state between tests.
  useAuthStore.setState({ user: null, isLoading: false });
  jest.clearAllMocks();
});

// ─── login ───────────────────────────────────────────────────────────────────

describe("login", () => {
  it("saves token and sets user on success", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { access_token: "tok-abc" },
    });
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });

    await useAuthStore.getState().login("test@example.com", "password");

    expect(saveToken).toHaveBeenCalledWith("tok-abc");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("resets isLoading and propagates error on API failure", async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new Error("Invalid credentials")
    );

    await expect(
      useAuthStore.getState().login("test@example.com", "wrong")
    ).rejects.toThrow("Invalid credentials");

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── register ────────────────────────────────────────────────────────────────

describe("register", () => {
  it("calls register endpoint then logs in on success", async () => {
    // First post → register, second post → login token
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({ data: {} }) // POST /auth/register
      .mockResolvedValueOnce({ data: { access_token: "tok-abc" } }); // POST /auth/login
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser }); // GET /auth/me

    await useAuthStore
      .getState()
      .register("test@example.com", "password", "Test User");

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/auth/register",
      expect.objectContaining({ email: "test@example.com", name: "Test User" })
    );
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("resets isLoading and propagates error when register fails", async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new Error("Email already taken")
    );

    await expect(
      useAuthStore
        .getState()
        .register("test@example.com", "password", "Test User")
    ).rejects.toThrow("Email already taken");

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("clears the token and sets user to null", async () => {
    useAuthStore.setState({ user: mockUser });

    await useAuthStore.getState().logout();

    expect(clearToken).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ─── fetchMe ─────────────────────────────────────────────────────────────────

describe("fetchMe", () => {
  it("sets user on success", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockUser });

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("clears token and sets user to null on any error", async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    await useAuthStore.getState().fetchMe();

    expect(clearToken).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
