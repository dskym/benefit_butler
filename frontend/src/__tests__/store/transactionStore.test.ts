// src/__tests__/store/transactionStore.test.ts

import { useTransactionStore } from "../../store/transactionStore";
import { apiClient } from "../../services/api";

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const makeTransaction = (id: string, amount: number, isFavorite = false) => ({
  id,
  user_id: "user-1",
  category_id: "cat-1",
  type: "expense" as const,
  amount,
  description: `거래 ${id}`,
  transacted_at: "2026-01-15T12:00:00Z",
  created_at: "2026-01-15T12:00:00Z",
  updated_at: "2026-01-15T12:00:00Z",
  payment_type: "cash" as const,
  user_card_id: null,
  is_favorite: isFavorite,
});

beforeEach(() => {
  useTransactionStore.setState({ transactions: [], isLoading: false });
  jest.clearAllMocks();
});

// ─── fetchTransactions ────────────────────────────────────────────────────────

describe("fetchTransactions", () => {
  it("replaces transactions list with server response", async () => {
    const serverData = [
      makeTransaction("t1", 10000),
      makeTransaction("t2", 5000),
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({ data: serverData });

    await useTransactionStore.getState().fetchTransactions();

    expect(useTransactionStore.getState().transactions).toEqual(serverData);
    expect(useTransactionStore.getState().isLoading).toBe(false);
  });

  it("resets isLoading even when the request fails", async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

    // The store has no catch block, so the error propagates to the caller.
    await expect(
      useTransactionStore.getState().fetchTransactions()
    ).rejects.toThrow("Network error");

    expect(useTransactionStore.getState().transactions).toEqual([]);
    expect(useTransactionStore.getState().isLoading).toBe(false);
  });
});

// ─── createTransaction ────────────────────────────────────────────────────────

describe("createTransaction", () => {
  it("prepends the new transaction to the list", async () => {
    const existing = makeTransaction("t1", 10000);
    useTransactionStore.setState({ transactions: [existing] });

    const newTx = makeTransaction("t2", 5000);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newTx });

    await useTransactionStore.getState().createTransaction({
      type: "expense",
      amount: 5000,
      transacted_at: "2026-01-15T12:00:00Z",
    });

    const { transactions } = useTransactionStore.getState();
    expect(transactions[0]).toEqual(newTx);
    expect(transactions[1]).toEqual(existing);
    expect(transactions).toHaveLength(2);
  });

  it("sends the correct payload to the API", async () => {
    const newTx = makeTransaction("t1", 15000);
    (apiClient.post as jest.Mock).mockResolvedValue({ data: newTx });

    const payload = {
      type: "expense" as const,
      amount: 15000,
      description: "점심",
      category_id: "cat-1",
      transacted_at: "2026-01-15T12:00:00Z",
      payment_type: "cash" as const,
    };

    await useTransactionStore.getState().createTransaction(payload);

    expect(apiClient.post).toHaveBeenCalledWith("/transactions/", payload);
  });
});

// ─── updateTransaction ────────────────────────────────────────────────────────

describe("updateTransaction", () => {
  it("replaces the matching transaction with server data", async () => {
    const t1 = makeTransaction("t1", 10000);
    const t2 = makeTransaction("t2", 5000);
    useTransactionStore.setState({ transactions: [t1, t2] });

    const updatedT1 = { ...t1, amount: 12000 };
    (apiClient.put as jest.Mock).mockResolvedValue({ data: updatedT1 });

    await useTransactionStore
      .getState()
      .updateTransaction("t1", { amount: 12000 });

    const { transactions } = useTransactionStore.getState();
    expect(transactions.find((t) => t.id === "t1")?.amount).toBe(12000);
    expect(transactions.find((t) => t.id === "t2")).toEqual(t2);
  });

  it("sends the correct payload to the API", async () => {
    const t1 = makeTransaction("t1", 10000);
    useTransactionStore.setState({ transactions: [t1] });
    (apiClient.put as jest.Mock).mockResolvedValue({
      data: { ...t1, description: "저녁" },
    });

    await useTransactionStore
      .getState()
      .updateTransaction("t1", { description: "저녁" });

    expect(apiClient.put).toHaveBeenCalledWith("/transactions/t1", {
      description: "저녁",
    });
  });
});

// ─── deleteTransaction ────────────────────────────────────────────────────────

describe("deleteTransaction", () => {
  it("removes the deleted transaction from the list", async () => {
    const t1 = makeTransaction("t1", 10000);
    const t2 = makeTransaction("t2", 5000);
    useTransactionStore.setState({ transactions: [t1, t2] });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useTransactionStore.getState().deleteTransaction("t1");

    const { transactions } = useTransactionStore.getState();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual(t2);
  });

  it("calls the correct endpoint", async () => {
    const t1 = makeTransaction("t1", 10000);
    useTransactionStore.setState({ transactions: [t1] });
    (apiClient.delete as jest.Mock).mockResolvedValue({});

    await useTransactionStore.getState().deleteTransaction("t1");

    expect(apiClient.delete).toHaveBeenCalledWith("/transactions/t1");
  });
});

// ─── toggleFavorite ───────────────────────────────────────────────────────────

describe("toggleFavorite", () => {
  it("marks a transaction as favorite", async () => {
    const t1 = makeTransaction("t1", 10000, false);
    useTransactionStore.setState({ transactions: [t1] });

    const toggled = { ...t1, is_favorite: true };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: toggled });

    await useTransactionStore.getState().toggleFavorite("t1", true);

    expect(
      useTransactionStore.getState().transactions.find((t) => t.id === "t1")
        ?.is_favorite
    ).toBe(true);
  });

  it("unmarks a transaction as favorite", async () => {
    const t1 = makeTransaction("t1", 10000, true);
    useTransactionStore.setState({ transactions: [t1] });

    const toggled = { ...t1, is_favorite: false };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: toggled });

    await useTransactionStore.getState().toggleFavorite("t1", false);

    expect(
      useTransactionStore.getState().transactions.find((t) => t.id === "t1")
        ?.is_favorite
    ).toBe(false);
  });

  it("sends the correct payload to the API", async () => {
    const t1 = makeTransaction("t1", 10000, false);
    useTransactionStore.setState({ transactions: [t1] });
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: { ...t1, is_favorite: true },
    });

    await useTransactionStore.getState().toggleFavorite("t1", true);

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/transactions/t1/favorite",
      { is_favorite: true }
    );
  });

  it("does not modify other transactions", async () => {
    const t1 = makeTransaction("t1", 10000, false);
    const t2 = makeTransaction("t2", 5000, false);
    useTransactionStore.setState({ transactions: [t1, t2] });

    const toggled = { ...t1, is_favorite: true };
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: toggled });

    await useTransactionStore.getState().toggleFavorite("t1", true);

    expect(
      useTransactionStore.getState().transactions.find((t) => t.id === "t2")
        ?.is_favorite
    ).toBe(false);
  });
});
