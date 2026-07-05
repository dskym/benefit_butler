// frontend/src/__tests__/store/recommendStore.test.ts
import { act, renderHook } from "@testing-library/react-native";
import { useRecommendStore } from "../../store/recommendStore";
import { BENEFIT_CATEGORIES } from "../../utils/benefitCategories";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const { apiClient } = require("../../services/api");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_RESOLVED = {
  merchant_id: "m-1",
  merchant_name: "스타벅스",
  category: "식비",
  source: "alias",
  confidence: 1.0,
};

const MOCK_LOOKUP = {
  ...MOCK_RESOLVED,
  available_categories: ["식비", "교통", "쇼핑"],
};

const MOCK_ITEMS = [
  {
    card_id: "card-1",
    card_name: "taptap O 카드",
    benefit_title: "스타벅스 50% 할인",
    benefit_type: "cashback",
    benefit_description: "스타벅스 50.0% 캐시백 / 월 최대 10,000원",
    matched_by: "merchant",
    effective_value: 5000,
    performance_required: true,
    performance_met: true,
    is_near_target: false,
  },
  {
    card_id: "card-2",
    card_name: "노리 카드",
    benefit_title: null,
    benefit_type: "cashback",
    benefit_description: "전체 1.5% 캐시백",
    matched_by: "all",
    effective_value: 150,
    performance_required: false,
    performance_met: null,
    is_near_target: true,
  },
];

const MOCK_RESPONSE = { resolved: MOCK_RESOLVED, results: MOCK_ITEMS };

const INITIAL = {
  results: [],
  resolved: null,
  availableCategories: BENEFIT_CATEGORIES,
  isLoading: false,
  isResolving: false,
  lastQuery: null,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useRecommendStore.setState(INITIAL);
  jest.clearAllMocks();
});

// ── resolveMerchant ───────────────────────────────────────────────────────────

describe("resolveMerchant", () => {
  it("calls GET /merchants/lookup and stores resolved merchant", async () => {
    apiClient.get.mockResolvedValueOnce({ data: MOCK_LOOKUP });

    const { result } = renderHook(() => useRecommendStore());
    let resolved;
    await act(async () => {
      resolved = await result.current.resolveMerchant("스타벅스");
    });

    expect(apiClient.get).toHaveBeenCalledWith("/merchants/lookup", {
      params: { q: "스타벅스" },
    });
    expect(resolved).toEqual(MOCK_RESOLVED);
    expect(result.current.resolved).toEqual(MOCK_RESOLVED);
    expect(result.current.availableCategories).toEqual(["식비", "교통", "쇼핑"]);
  });

  it("skips lookup for queries shorter than 2 chars and clears resolved", async () => {
    useRecommendStore.setState({ resolved: MOCK_RESOLVED });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.resolveMerchant("스");
    });

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result.current.resolved).toBeNull();
  });

  it("swallows API errors and clears resolved", async () => {
    useRecommendStore.setState({ resolved: MOCK_RESOLVED });
    apiClient.get.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useRecommendStore());
    let resolved;
    await act(async () => {
      resolved = await result.current.resolveMerchant("스타벅스");
    });

    expect(resolved).toBeNull();
    expect(result.current.resolved).toBeNull();
    expect(result.current.isResolving).toBe(false);
  });

  it("falls back to default categories when response omits them", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { ...MOCK_RESOLVED, available_categories: [] },
    });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.resolveMerchant("스타벅스");
    });

    expect(result.current.availableCategories).toEqual(BENEFIT_CATEGORIES);
  });
});

// ── recommend ─────────────────────────────────────────────────────────────────

describe("recommend", () => {
  it("calls POST /cards/recommend and stores results + resolved", async () => {
    apiClient.post.mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("스타벅스", 10000, "식비");
    });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/recommend", {
      merchant_name: "스타벅스",
      amount: 10000,
      category: "식비",
    });
    expect(result.current.results).toEqual(MOCK_ITEMS);
    expect(result.current.resolved).toEqual(MOCK_RESOLVED);
    expect(result.current.lastQuery).toEqual({
      merchantName: "스타벅스",
      amount: 10000,
      category: "식비",
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("passes merchant_id when already resolved (skips server re-resolve)", async () => {
    useRecommendStore.setState({ resolved: MOCK_RESOLVED });
    apiClient.post.mockResolvedValueOnce({ data: MOCK_RESPONSE });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("스타벅스", 10000, null);
    });

    const sentBody = apiClient.post.mock.calls[0][1];
    expect(sentBody.merchant_id).toBe("m-1");
    expect(Object.keys(sentBody)).not.toContain("category");
  });

  it("omits category from body when category is null", async () => {
    apiClient.post.mockResolvedValueOnce({ data: { resolved: null, results: [] } });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("이마트", 50000, null);
    });

    expect(apiClient.post).toHaveBeenCalledWith("/cards/recommend", {
      merchant_name: "이마트",
      amount: 50000,
    });
  });

  it("keeps client-side resolved when server returns resolved=null", async () => {
    useRecommendStore.setState({ resolved: MOCK_RESOLVED });
    apiClient.post.mockResolvedValueOnce({ data: { resolved: null, results: [] } });

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("스타벅스", 10000, null);
    });

    expect(result.current.resolved).toEqual(MOCK_RESOLVED);
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
      resolve!({ data: { resolved: null, results: [] } });
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

  it("propagates API error to caller (no internal catch)", async () => {
    apiClient.post.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useRecommendStore());
    await expect(
      act(async () => {
        await result.current.recommend("test", 1000, null);
      })
    ).rejects.toThrow("Network error");
  });

  it("preserves existing results and lastQuery on error", async () => {
    useRecommendStore.setState({
      results: MOCK_ITEMS,
      lastQuery: { merchantName: "스타벅스", amount: 10000, category: "식비" },
    });
    apiClient.post.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useRecommendStore());
    await act(async () => {
      await result.current.recommend("test", 1000, null).catch(() => {});
    });

    expect(result.current.results).toEqual(MOCK_ITEMS);
    expect(result.current.lastQuery?.merchantName).toBe("스타벅스");
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe("clear", () => {
  it("resets results, resolved and lastQuery", () => {
    useRecommendStore.setState({
      results: MOCK_ITEMS,
      resolved: MOCK_RESOLVED,
      lastQuery: { merchantName: "스타벅스", amount: 10000, category: "식비" },
    });

    const { result } = renderHook(() => useRecommendStore());
    act(() => {
      result.current.clear();
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.resolved).toBeNull();
    expect(result.current.lastQuery).toBeNull();
  });
});

// ── initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with empty results, default categories, and isLoading false", () => {
    const { result } = renderHook(() => useRecommendStore());
    expect(result.current.results).toEqual([]);
    expect(result.current.resolved).toBeNull();
    expect(result.current.availableCategories).toEqual(BENEFIT_CATEGORIES);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lastQuery).toBeNull();
  });
});
