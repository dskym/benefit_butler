// frontend/src/__tests__/store/recommendStore.test.ts
import { act, renderHook } from "@testing-library/react-native";
import { useRecommendStore } from "../../store/recommendStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const { apiClient } = require("../../services/api");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_RESULTS = [
  {
    card_id: "card-1",
    card_name: "Deep Dream 카드",
    benefit_type: "cashback",
    benefit_description: "식비 3% 캐시백 / 월 최대 10,000원",
    effective_value: 300,
    is_near_target: false,
  },
  {
    card_id: "card-2",
    card_name: "노리 카드",
    benefit_type: "cashback",
    benefit_description: "전체 1.5% 캐시백",
    effective_value: 150,
    is_near_target: true,
  },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useRecommendStore.setState({ results: [], isLoading: false, lastQuery: null });
  jest.clearAllMocks();
});

// ── recommend ─────────────────────────────────────────────────────────────────

describe("recommend", () => {
  it("calls POST /cards/recommend and stores results", async () => {
    apiClient.post.mockResolvedValueOnce({ data: MOCK_RESULTS });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("스타벅스", 10000, "식비");
    });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/recommend", {
      merchant_name: "스타벅스",
      amount: 10000,
      category: "식비",
    });
    expect(result.current.results).toEqual(MOCK_RESULTS);
    expect(result.current.lastQuery).toEqual({
      merchantName: "스타벅스",
      amount: 10000,
      category: "식비",
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("omits category from body when category is null", async () => {
    apiClient.post.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("이마트", 50000, null);
    });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/recommend", {
      merchant_name: "이마트",
      amount: 50000,
      // category NOT included
    });
  });

  it("sets isLoading true during request and false after", async () => {
    let resolve: (v: any) => void;
    const pending = new Promise<any>((r) => { resolve = r; });
    apiClient.post.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useRecommendStore());
    let fetchPromise: Promise<void>;
    act(() => { fetchPromise = result.current.recommend("test", 1000, null); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!({ data: [] });
      await fetchPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading on API error", async () => {
    apiClient.post.mockRejectedValueOnce(new Error("Server error"));

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("test", 1000, null).catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("stores empty results when API returns empty array", async () => {
    useRecommendStore.setState({ results: MOCK_RESULTS, isLoading: false, lastQuery: null });
    apiClient.post.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("알 수 없는 가맹점", 10000, null);
    });

    expect(result.current.results).toEqual([]);
  });

  it("propagates API error to caller (no internal catch)", async () => {
    const apiError = new Error("Network error");
    apiClient.post.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useRecommendStore());
    await expect(
      act(async () => {
        await result.current.recommend("test", 1000, null);
      })
    ).rejects.toThrow("Network error");
  });

  it("preserves existing results and lastQuery on error", async () => {
    useRecommendStore.setState({
      results: MOCK_RESULTS,
      lastQuery: { merchantName: "스타벅스", amount: 10000, category: "식비" },
      isLoading: false,
    });
    apiClient.post.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("test", 1000, null).catch(() => {});
    });

    expect(result.current.results).toEqual(MOCK_RESULTS);
    expect(result.current.lastQuery).toEqual({
      merchantName: "스타벅스",
      amount: 10000,
      category: "식비",
    });
  });

  it("overwrites lastQuery on each successful call", async () => {
    apiClient.post.mockResolvedValueOnce({ data: MOCK_RESULTS });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("first", 1000, null);
    });
    expect(result.current.lastQuery?.merchantName).toBe("first");

    apiClient.post.mockResolvedValueOnce({ data: [] });
    await act(async () => {
      await result.current.recommend("second", 2000, "쇼핑");
    });
    expect(result.current.lastQuery).toEqual({
      merchantName: "second",
      amount: 2000,
      category: "쇼핑",
    });
  });

  it("does not include category key in body when category is null", async () => {
    apiClient.post.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("test", 1000, null);
    });

    const sentBody = apiClient.post.mock.calls[0][1];
    expect(Object.keys(sentBody)).not.toContain("category");
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe("clear", () => {
  it("resets results and lastQuery", () => {
    useRecommendStore.setState({ results: MOCK_RESULTS, isLoading: false, lastQuery: { merchantName: "스타벅스", amount: 10000, category: "식비" } });

    const { result } = renderHook(() => useRecommendStore());
    act(() => {
      result.current.clear();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.lastQuery).toBeNull();
  });
});

// ── initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with empty results and isLoading false", () => {
    const { result } = renderHook(() => useRecommendStore());
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lastQuery).toBeNull();
  });
});
