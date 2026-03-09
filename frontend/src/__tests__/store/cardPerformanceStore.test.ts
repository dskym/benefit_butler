// frontend/src/__tests__/store/cardPerformanceStore.test.ts
import { act, renderHook } from "@testing-library/react-native";
import { useCardPerformanceStore } from "../../store/cardPerformanceStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_PERFORMANCE = [
  {
    card_id: "card-1",
    card_name: "신한카드",
    card_type: "credit_card",
    monthly_target: 300000,
    billing_day: 14,
    period_start: "2026-02-01",
    period_end: "2026-02-28",
    current_spending: 150000,
    remaining: 150000,
    achievement_percent: 50.0,
  },
  {
    card_id: "card-2",
    card_name: "카카오뱅크",
    card_type: "debit_card",
    monthly_target: null,
    billing_day: null,
    period_start: "2026-02-01",
    period_end: "2026-02-28",
    current_spending: 0,
    remaining: null,
    achievement_percent: null,
  },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useCardPerformanceStore.setState({ performances: [], isLoading: false });
  jest.clearAllMocks();
});

// ── fetchPerformance ──────────────────────────────────────────────────────────

describe("fetchPerformance", () => {
  it("sets performances from API response", async () => {
    apiClient.get.mockResolvedValueOnce({ data: MOCK_PERFORMANCE });

    const { result } = renderHook(() => useCardPerformanceStore());

    await act(async () => {
      await result.current.fetchPerformance();
    });

    expect(apiClient.get).toHaveBeenCalledWith("/cards/performance");
    expect(result.current.performances).toEqual(MOCK_PERFORMANCE);
    expect(result.current.isLoading).toBe(false);
  });

  it("sets isLoading to true during fetch and false after", async () => {
    let resolveGet: (v: any) => void;
    const pending = new Promise<any>((resolve) => { resolveGet = resolve; });
    apiClient.get.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useCardPerformanceStore());

    let fetchPromise: Promise<void>;
    act(() => {
      fetchPromise = result.current.fetchPerformance();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveGet!({ data: [] });
      await fetchPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false on API error (stale data preserved)", async () => {
    // Pre-populate with stale data
    useCardPerformanceStore.setState({ performances: MOCK_PERFORMANCE, isLoading: false });
    apiClient.get.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCardPerformanceStore());

    await act(async () => {
      await result.current.fetchPerformance().catch(() => {});
    });

    // isLoading should be cleared even on error
    expect(result.current.isLoading).toBe(false);
    // Stale cached data is preserved (offline support)
    expect(result.current.performances).toEqual(MOCK_PERFORMANCE);
  });

  it("sets empty array when API returns empty list", async () => {
    useCardPerformanceStore.setState({ performances: MOCK_PERFORMANCE, isLoading: false });
    apiClient.get.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useCardPerformanceStore());

    await act(async () => {
      await result.current.fetchPerformance();
    });

    expect(result.current.performances).toEqual([]);
  });

  it("does not overwrite stale data while loading", async () => {
    useCardPerformanceStore.setState({ performances: MOCK_PERFORMANCE, isLoading: false });

    let resolveGet: (v: any) => void;
    const pending = new Promise<any>((resolve) => { resolveGet = resolve; });
    apiClient.get.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useCardPerformanceStore());

    act(() => {
      result.current.fetchPerformance();
    });

    // Stale data still available while loading
    expect(result.current.performances).toEqual(MOCK_PERFORMANCE);

    await act(async () => {
      resolveGet!({ data: [] });
    });
  });

  it("stores multiple performance items from API", async () => {
    const multiple = [
      ...MOCK_PERFORMANCE,
      {
        card_id: "card-3",
        card_name: "하나카드",
        card_type: "credit_card",
        monthly_target: 500000,
        billing_day: 25,
        period_start: "2026-02-26",
        period_end: "2026-03-25",
        current_spending: 450000,
        remaining: 50000,
        achievement_percent: 90.0,
      },
    ];
    apiClient.get.mockResolvedValueOnce({ data: multiple });

    const { result } = renderHook(() => useCardPerformanceStore());
    await act(async () => {
      await result.current.fetchPerformance();
    });

    expect(result.current.performances).toHaveLength(3);
  });

  it("handles items where all optional fields are null", async () => {
    const nullItem = [{
      card_id: "card-null",
      card_name: "기본카드",
      card_type: "debit_card",
      monthly_target: null,
      billing_day: null,
      period_start: "2026-03-01",
      period_end: "2026-03-31",
      current_spending: 0,
      remaining: null,
      achievement_percent: null,
    }];
    apiClient.get.mockResolvedValueOnce({ data: nullItem });

    const { result } = renderHook(() => useCardPerformanceStore());
    await act(async () => {
      await result.current.fetchPerformance();
    });

    expect(result.current.performances[0].monthly_target).toBeNull();
    expect(result.current.performances[0].billing_day).toBeNull();
    expect(result.current.performances[0].remaining).toBeNull();
    expect(result.current.performances[0].achievement_percent).toBeNull();
  });

  it("propagates API error to caller", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("Server error"));

    const { result } = renderHook(() => useCardPerformanceStore());
    await expect(
      act(async () => {
        await result.current.fetchPerformance();
      })
    ).rejects.toThrow("Server error");
    expect(result.current.isLoading).toBe(false);
  });

  it("preserves stale data on API error", async () => {
    useCardPerformanceStore.setState({ performances: MOCK_PERFORMANCE, isLoading: false });
    apiClient.get.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useCardPerformanceStore());
    await act(async () => {
      await result.current.fetchPerformance().catch(() => {});
    });

    expect(result.current.performances).toEqual(MOCK_PERFORMANCE);
  });
});

// ── initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with empty performances and isLoading false", () => {
    const { result } = renderHook(() => useCardPerformanceStore());
    expect(result.current.performances).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
