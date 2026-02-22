// src/__tests__/store/categoryStore.test.ts

jest.mock('../../storage', () => ({
  mmkvStorage: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { useCategoryStore } from "../../store/categoryStore";
import { apiClient } from "../../services/api";

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const makeCategory = (id: string, name: string) => ({
  id,
  user_id: "user-1",
  name,
  type: "expense" as const,
  color: "#3182F6",
  is_default: false,
  created_at: "2026-01-01T00:00:00Z",
});

beforeEach(() => {
  useCategoryStore.setState({ categories: [], isLoading: false });
  jest.clearAllMocks();
});

// ─── fetchCategories ──────────────────────────────────────────────────────────

describe("fetchCategories", () => {
  it("replaces categories list with server response", async () => {
    const serverData = [makeCategory("c1", "식비"), makeCategory("c2", "교통")];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: serverData });

    await useCategoryStore.getState().fetchCategories();

    expect(useCategoryStore.getState().categories).toEqual(serverData);
    expect(useCategoryStore.getState().isLoading).toBe(false);
  });

  it("resets isLoading even when the request fails", async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

    // The store has no catch block, so the error propagates to the caller.
    await expect(
      useCategoryStore.getState().fetchCategories()
    ).rejects.toThrow("Network error");

    expect(useCategoryStore.getState().categories).toEqual([]);
    expect(useCategoryStore.getState().isLoading).toBe(false);
  });
});

// ─── createCategory ───────────────────────────────────────────────────────────

describe("createCategory", () => {
  it("prepends the new category to the list", async () => {
    const existing = makeCategory("c1", "식비");
    useCategoryStore.setState({ categories: [existing] });

    const newCategory = makeCategory("c2", "교통");
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newCategory });

    await useCategoryStore
      .getState()
      .createCategory({ name: "교통", type: "expense" });

    const { categories } = useCategoryStore.getState();
    expect(categories[0]).toEqual(newCategory);
    expect(categories[1]).toEqual(existing);
    expect(categories).toHaveLength(2);
  });

  it("sends the correct payload to the API", async () => {
    const newCategory = makeCategory("c1", "여가");
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newCategory });

    await useCategoryStore
      .getState()
      .createCategory({ name: "여가", type: "expense", color: "#FF5733" });

    expect(apiClient.post).toHaveBeenCalledWith("/categories/", {
      name: "여가",
      type: "expense",
      color: "#FF5733",
    });
  });
});

// ─── updateCategory ───────────────────────────────────────────────────────────

describe("updateCategory", () => {
  it("replaces the matching category in the list with server data", async () => {
    const original = makeCategory("c1", "식비");
    const other = makeCategory("c2", "교통");
    useCategoryStore.setState({ categories: [original, other] });

    const updated = { ...original, name: "외식" };
    (apiClient.put as jest.Mock).mockResolvedValue({ data: updated });

    await useCategoryStore.getState().updateCategory("c1", { name: "외식" });

    const { categories } = useCategoryStore.getState();
    expect(categories.find((c) => c.id === "c1")?.name).toBe("외식");
    expect(categories.find((c) => c.id === "c2")).toEqual(other);
  });

  it("sends the correct payload to the API", async () => {
    const cat = makeCategory("c1", "식비");
    useCategoryStore.setState({ categories: [cat] });
    (apiClient.put as jest.Mock).mockResolvedValue({
      data: { ...cat, color: "#FF0000" },
    });

    await useCategoryStore.getState().updateCategory("c1", { color: "#FF0000" });

    expect(apiClient.put).toHaveBeenCalledWith("/categories/c1", {
      color: "#FF0000",
    });
  });
});

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe("deleteCategory", () => {
  it("removes the deleted category from the list", async () => {
    const c1 = makeCategory("c1", "식비");
    const c2 = makeCategory("c2", "교통");
    useCategoryStore.setState({ categories: [c1, c2] });

    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useCategoryStore.getState().deleteCategory("c1");

    const { categories } = useCategoryStore.getState();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toEqual(c2);
  });

  it("calls the correct endpoint", async () => {
    const cat = makeCategory("c1", "식비");
    useCategoryStore.setState({ categories: [cat] });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useCategoryStore.getState().deleteCategory("c1");

    expect(apiClient.delete).toHaveBeenCalledWith("/categories/c1");
  });
});
