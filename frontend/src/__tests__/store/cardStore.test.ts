// src/__tests__/store/cardStore.test.ts

import { useCardStore } from "../../store/cardStore";
import { apiClient } from "../../services/api";

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const makeCard = (id: string, name: string) => ({
  id,
  user_id: "user-1",
  type: "credit_card" as const,
  name,
  monthly_target: null,
  billing_day: null,
  catalog_id: null,
  created_at: "2026-01-01T00:00:00Z",
});

const makeCatalog = (id: string, name: string) => ({
  id,
  name,
  issuer: "신한카드",
  card_type: "credit_card" as const,
  image_url: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  benefits: [],
});

beforeEach(() => {
  useCardStore.setState({ cards: [], catalogResults: [], isLoading: false, isSearchingCatalog: false });
  jest.clearAllMocks();
});

// ─── fetchCards ───────────────────────────────────────────────────────────────

describe("fetchCards", () => {
  it("replaces cards list with server response", async () => {
    const serverData = [makeCard("card-1", "신한카드"), makeCard("card-2", "KB카드")];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: serverData });

    await useCardStore.getState().fetchCards();

    expect(useCardStore.getState().cards).toEqual(serverData);
    expect(useCardStore.getState().isLoading).toBe(false);
  });

  it("resets isLoading even when the request fails", async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

    // The store has no catch block, so the error propagates to the caller.
    await expect(useCardStore.getState().fetchCards()).rejects.toThrow(
      "Network error"
    );

    expect(useCardStore.getState().cards).toEqual([]);
    expect(useCardStore.getState().isLoading).toBe(false);
  });
});

// ─── createCard ───────────────────────────────────────────────────────────────

describe("createCard", () => {
  it("appends the new card to the list and returns it", async () => {
    const existing = makeCard("card-1", "신한카드");
    useCardStore.setState({ cards: [existing] });

    const newCard = makeCard("card-2", "KB카드");
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newCard });

    const result = await useCardStore
      .getState()
      .createCard({ type: "credit_card", name: "KB카드" });

    expect(result).toEqual(newCard);
    const { cards } = useCardStore.getState();
    expect(cards).toHaveLength(2);
    expect(cards[cards.length - 1]).toEqual(newCard);
  });

  it("sends the correct payload to the API", async () => {
    const newCard = makeCard("card-1", "신한카드");
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newCard });

    await useCardStore
      .getState()
      .createCard({ type: "credit_card", name: "신한카드" });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/", {
      type: "credit_card",
      name: "신한카드",
    });
  });

  it("passes catalog_id for catalog-linked card creation", async () => {
    const newCard = { ...makeCard("card-1", "Deep Dream 카드"), catalog_id: "cat-1" };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newCard });

    await useCardStore
      .getState()
      .createCard({ type: "credit_card", name: "Deep Dream 카드", catalog_id: "cat-1" });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/", {
      type: "credit_card",
      name: "Deep Dream 카드",
      catalog_id: "cat-1",
    });
    expect(useCardStore.getState().cards[0].catalog_id).toBe("cat-1");
  });
});

// ─── searchCatalog ────────────────────────────────────────────────────────────

describe("searchCatalog", () => {
  it("calls GET /cards/catalog/ with query and stores results", async () => {
    const results = [makeCatalog("cat-1", "Deep Dream 카드")];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: results });

    await useCardStore.getState().searchCatalog("딥드림");

    expect(apiClient.get).toHaveBeenCalledWith("/cards/catalog/", { params: { q: "딥드림" } });
    expect(useCardStore.getState().catalogResults).toEqual(results);
    expect(useCardStore.getState().isSearchingCatalog).toBe(false);
  });

  it("clears results for empty query without calling API", async () => {
    useCardStore.setState({ catalogResults: [makeCatalog("cat-1", "x")] });

    await useCardStore.getState().searchCatalog("  ");

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(useCardStore.getState().catalogResults).toEqual([]);
  });

  it("swallows API errors and clears results", async () => {
    useCardStore.setState({ catalogResults: [makeCatalog("cat-1", "x")] });
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("network"));

    await useCardStore.getState().searchCatalog("딥드림");

    expect(useCardStore.getState().catalogResults).toEqual([]);
    expect(useCardStore.getState().isSearchingCatalog).toBe(false);
  });

  it("clearCatalogResults empties the list", () => {
    useCardStore.setState({ catalogResults: [makeCatalog("cat-1", "x")] });
    useCardStore.getState().clearCatalogResults();
    expect(useCardStore.getState().catalogResults).toEqual([]);
  });
});

// ─── updateCard ───────────────────────────────────────────────────────────────

describe("updateCard", () => {
  it("replaces the matching card with the server response", async () => {
    const card = makeCard("card-1", "신한카드");
    const other = makeCard("card-2", "KB카드");
    useCardStore.setState({ cards: [card, other] });

    const updated = { ...card, monthly_target: 500000 };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });

    await useCardStore.getState().updateCard("card-1", { monthly_target: 500000 });

    const { cards } = useCardStore.getState();
    expect(cards.find((c) => c.id === "card-1")?.monthly_target).toBe(500000);
    expect(cards.find((c) => c.id === "card-2")).toEqual(other);
  });

  it("sends the correct payload to the API", async () => {
    const card = makeCard("card-1", "신한카드");
    useCardStore.setState({ cards: [card] });
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { ...card, monthly_target: 300000 },
    });

    await useCardStore.getState().updateCard("card-1", { monthly_target: 300000 });

    expect(apiClient.patch).toHaveBeenCalledWith("/cards/card-1", {
      monthly_target: 300000,
    });
  });

  it("can set monthly_target to null", async () => {
    const card = { ...makeCard("card-1", "신한카드"), monthly_target: 500000 };
    useCardStore.setState({ cards: [card] });
    const updated = { ...card, monthly_target: null };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });

    await useCardStore.getState().updateCard("card-1", { monthly_target: null });

    expect(
      useCardStore.getState().cards.find((c) => c.id === "card-1")
        ?.monthly_target
    ).toBeNull();
  });

  it("can set billing_day along with monthly_target", async () => {
    const card = makeCard("card-1", "신한카드");
    useCardStore.setState({ cards: [card] });
    const updated = { ...card, monthly_target: 300000, billing_day: 14 };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });

    await useCardStore.getState().updateCard("card-1", { monthly_target: 300000, billing_day: 14 });

    expect(apiClient.patch).toHaveBeenCalledWith("/cards/card-1", {
      monthly_target: 300000,
      billing_day: 14,
    });
    expect(useCardStore.getState().cards.find((c) => c.id === "card-1")?.billing_day).toBe(14);
  });
});

// ─── deleteCard ───────────────────────────────────────────────────────────────

describe("deleteCard", () => {
  it("removes the deleted card from the list", async () => {
    const c1 = makeCard("card-1", "신한카드");
    const c2 = makeCard("card-2", "KB카드");
    useCardStore.setState({ cards: [c1, c2] });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useCardStore.getState().deleteCard("card-1");

    const { cards } = useCardStore.getState();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual(c2);
  });

  it("calls the correct endpoint", async () => {
    const card = makeCard("card-1", "신한카드");
    useCardStore.setState({ cards: [card] });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useCardStore.getState().deleteCard("card-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/cards/card-1");
  });
});
