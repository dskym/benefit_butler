// frontend/src/__tests__/store/cardBenefitStore.test.ts
import { act, renderHook } from "@testing-library/react-native";
import { useCardBenefitStore } from "../../store/cardBenefitStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../storage", () => ({
  createPlatformStorage: jest.fn(() => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

const { apiClient } = require("../../services/api");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CARD_ID = "card-111";
const BENEFIT_1 = {
  id: "benefit-1",
  user_card_id: CARD_ID,
  category: "식비",
  benefit_type: "cashback",
  rate: 3.0,
  flat_amount: null,
  monthly_cap: 10000,
  min_amount: null,
  created_at: "2026-02-26T00:00:00Z",
};
const BENEFIT_2 = {
  id: "benefit-2",
  user_card_id: CARD_ID,
  category: "전체",
  benefit_type: "points",
  rate: 1.0,
  flat_amount: null,
  monthly_cap: null,
  min_amount: null,
  created_at: "2026-02-26T00:01:00Z",
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useCardBenefitStore.setState({ benefits: {}, isLoading: false });
  jest.clearAllMocks();
});

// ── fetchBenefits ─────────────────────────────────────────────────────────────

describe("fetchBenefits", () => {
  it("loads benefits for a card and stores by card_id", async () => {
    apiClient.get.mockResolvedValueOnce({ data: [BENEFIT_1, BENEFIT_2] });

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.fetchBenefits(CARD_ID);
    });

    expect(apiClient.get).toHaveBeenCalledWith(`/cards/${CARD_ID}/benefits`);
    expect(result.current.benefits[CARD_ID]).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("sets isLoading true during fetch and false after", async () => {
    let resolve: (v: any) => void;
    const pending = new Promise<any>((r) => { resolve = r; });
    apiClient.get.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useCardBenefitStore());
    let fetchPromise: Promise<void>;
    act(() => { fetchPromise = result.current.fetchBenefits(CARD_ID); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!({ data: [] });
      await fetchPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading on error", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.fetchBenefits(CARD_ID).catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("keeps other card benefits when fetching for a new card", async () => {
    useCardBenefitStore.setState({ benefits: { "other-card": [BENEFIT_2] }, isLoading: false });
    apiClient.get.mockResolvedValueOnce({ data: [BENEFIT_1] });

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.fetchBenefits(CARD_ID);
    });

    expect(result.current.benefits["other-card"]).toHaveLength(1);
    expect(result.current.benefits[CARD_ID]).toHaveLength(1);
  });
});

// ── createBenefit ─────────────────────────────────────────────────────────────

describe("createBenefit", () => {
  it("appends new benefit to the card's list and returns it", async () => {
    useCardBenefitStore.setState({ benefits: { [CARD_ID]: [BENEFIT_2] }, isLoading: false });
    apiClient.post.mockResolvedValueOnce({ data: BENEFIT_1 });

    const { result } = renderHook(() => useCardBenefitStore());
    let returned: any;
    await act(async () => {
      returned = await result.current.createBenefit(CARD_ID, {
        category: "식비",
        benefit_type: "cashback",
        rate: 3.0,
        monthly_cap: 10000,
      });
    });

    expect(apiClient.post).toHaveBeenCalledWith(`/cards/${CARD_ID}/benefits`, expect.any(Object));
    expect(result.current.benefits[CARD_ID]).toHaveLength(2);
    expect(returned).toEqual(BENEFIT_1);
  });

  it("initialises empty array for card before appending", async () => {
    apiClient.post.mockResolvedValueOnce({ data: BENEFIT_1 });

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.createBenefit(CARD_ID, {
        category: "식비",
        benefit_type: "cashback",
        rate: 3.0,
      });
    });

    expect(result.current.benefits[CARD_ID]).toHaveLength(1);
  });

  it("propagates API error", async () => {
    apiClient.post.mockRejectedValueOnce(new Error("API error"));

    const { result } = renderHook(() => useCardBenefitStore());
    await expect(
      act(async () => {
        await result.current.createBenefit(CARD_ID, { category: "전체", benefit_type: "cashback" });
      })
    ).rejects.toThrow("API error");
  });
});

// ── updateBenefit ─────────────────────────────────────────────────────────────

describe("updateBenefit", () => {
  it("replaces the updated benefit in store", async () => {
    useCardBenefitStore.setState({ benefits: { [CARD_ID]: [BENEFIT_1, BENEFIT_2] }, isLoading: false });
    const updated = { ...BENEFIT_1, rate: 5.0 };
    apiClient.patch.mockResolvedValueOnce({ data: updated });

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.updateBenefit(CARD_ID, BENEFIT_1.id, { rate: 5.0 });
    });

    const stored = result.current.benefits[CARD_ID].find((b) => b.id === BENEFIT_1.id);
    expect(stored?.rate).toBe(5.0);
    // Other benefit unchanged
    expect(result.current.benefits[CARD_ID]).toHaveLength(2);
  });

  it("propagates API error", async () => {
    useCardBenefitStore.setState({ benefits: { [CARD_ID]: [BENEFIT_1] }, isLoading: false });
    apiClient.patch.mockRejectedValueOnce(new Error("not found"));

    const { result } = renderHook(() => useCardBenefitStore());
    await expect(
      act(async () => {
        await result.current.updateBenefit(CARD_ID, BENEFIT_1.id, { rate: 1.0 });
      })
    ).rejects.toThrow("not found");
  });
});

// ── deleteBenefit ─────────────────────────────────────────────────────────────

describe("deleteBenefit", () => {
  it("removes the benefit from store", async () => {
    useCardBenefitStore.setState({ benefits: { [CARD_ID]: [BENEFIT_1, BENEFIT_2] }, isLoading: false });
    apiClient.delete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useCardBenefitStore());
    await act(async () => {
      await result.current.deleteBenefit(CARD_ID, BENEFIT_1.id);
    });

    expect(result.current.benefits[CARD_ID]).toHaveLength(1);
    expect(result.current.benefits[CARD_ID][0].id).toBe(BENEFIT_2.id);
  });

  it("propagates API error", async () => {
    useCardBenefitStore.setState({ benefits: { [CARD_ID]: [BENEFIT_1] }, isLoading: false });
    apiClient.delete.mockRejectedValueOnce(new Error("not found"));

    const { result } = renderHook(() => useCardBenefitStore());
    await expect(
      act(async () => {
        await result.current.deleteBenefit(CARD_ID, BENEFIT_1.id);
      })
    ).rejects.toThrow("not found");
  });
});

// ── initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with empty benefits and isLoading false", () => {
    const { result } = renderHook(() => useCardBenefitStore());
    expect(result.current.benefits).toEqual({});
    expect(result.current.isLoading).toBe(false);
  });
});
