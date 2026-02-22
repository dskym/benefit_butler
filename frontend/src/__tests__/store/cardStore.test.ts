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
  created_at: "2026-01-01T00:00:00Z",
});

beforeEach(() => {
  useCardStore.setState({ cards: [], isLoading: false });
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
});

// ─── updateCard ───────────────────────────────────────────────────────────────

describe("updateCard", () => {
  it("replaces the matching card with the server response", async () => {
    const card = makeCard("card-1", "신한카드");
    const other = makeCard("card-2", "KB카드");
    useCardStore.setState({ cards: [card, other] });

    const updated = { ...card, monthly_target: 500000 };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });

    await useCardStore.getState().updateCard("card-1", 500000);

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

    await useCardStore.getState().updateCard("card-1", 300000);

    expect(apiClient.patch).toHaveBeenCalledWith("/cards/card-1", {
      monthly_target: 300000,
    });
  });

  it("can set monthly_target to null", async () => {
    const card = { ...makeCard("card-1", "신한카드"), monthly_target: 500000 };
    useCardStore.setState({ cards: [card] });
    const updated = { ...card, monthly_target: null };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: updated });

    await useCardStore.getState().updateCard("card-1", null);

    expect(
      useCardStore.getState().cards.find((c) => c.id === "card-1")
        ?.monthly_target
    ).toBeNull();
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
