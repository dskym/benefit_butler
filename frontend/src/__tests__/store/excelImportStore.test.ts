// frontend/src/__tests__/store/excelImportStore.test.ts
import { useExcelImportStore } from "../../store/excelImportStore";

// Mock apiClient
jest.mock("../../services/api", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from "../../services/api";
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

const INITIAL_STATE = {
  step: "idle",
  importId: null,
  headers: [],
  mapping: {
    transacted_at: null,
    amount: null,
    description: null,
    type: null,
    category_name: null,
    payment_type: null,
    card_name: null,
  },
  previewRows: [],
  totalRows: 0,
  result: null,
  error: null,
};

describe("excelImportStore", () => {
  beforeEach(() => {
    useExcelImportStore.setState({ ...INITIAL_STATE });
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("sets preview state on success", async () => {
      const previewResponse = {
        import_id: "test-import-id",
        headers: ["날짜", "금액", "내역"],
        auto_mapping: {
          transacted_at: 0,
          amount: 1,
          description: 2,
          type: null,
          category_name: null,
          payment_type: null,
          card_name: null,
        },
        preview_rows: [["2024-01-15", "15000", "스타벅스"]],
        total_rows: 1,
      };
      mockPost.mockResolvedValueOnce({ data: previewResponse });

      // Mock fetch for web platform blob handling
      global.fetch = jest.fn().mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob()),
      });

      await useExcelImportStore.getState().uploadFile("file://test.xlsx", "test.xlsx");

      const state = useExcelImportStore.getState();
      expect(state.step).toBe("preview");
      expect(state.importId).toBe("test-import-id");
      expect(state.headers).toEqual(["날짜", "금액", "내역"]);
      expect(state.mapping.transacted_at).toBe(0);
      expect(state.mapping.amount).toBe(1);
      expect(state.mapping.description).toBe(2);
      expect(state.previewRows).toHaveLength(1);
      expect(state.totalRows).toBe(1);
    });

    it("sets error state on failure", async () => {
      mockPost.mockRejectedValueOnce({
        response: { data: { detail: "올바른 xlsx 파일이 아닙니다." } },
      });

      global.fetch = jest.fn().mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob()),
      });

      await useExcelImportStore.getState().uploadFile("file://bad.xlsx", "bad.xlsx");

      const state = useExcelImportStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("올바른 xlsx 파일이 아닙니다.");
    });

    it("sets uploading step during upload", async () => {
      let resolvePost: any;
      mockPost.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePost = resolve;
        })
      );

      global.fetch = jest.fn().mockResolvedValueOnce({
        blob: () => Promise.resolve(new Blob()),
      });

      const promise = useExcelImportStore.getState().uploadFile("file://test.xlsx", "test.xlsx");

      // Check intermediate state
      expect(useExcelImportStore.getState().step).toBe("uploading");

      resolvePost({
        data: {
          import_id: "id",
          headers: [],
          auto_mapping: INITIAL_STATE.mapping,
          preview_rows: [],
          total_rows: 0,
        },
      });
      await promise;
    });
  });

  describe("updateMapping", () => {
    it("updates a specific field mapping", () => {
      useExcelImportStore.getState().updateMapping("transacted_at", 0);
      expect(useExcelImportStore.getState().mapping.transacted_at).toBe(0);
    });

    it("clears a field mapping with null", () => {
      useExcelImportStore.setState({
        mapping: { ...INITIAL_STATE.mapping, transacted_at: 0 },
      });

      useExcelImportStore.getState().updateMapping("transacted_at", null);
      expect(useExcelImportStore.getState().mapping.transacted_at).toBeNull();
    });

    it("updates multiple fields independently", () => {
      const store = useExcelImportStore.getState();
      store.updateMapping("transacted_at", 0);
      store.updateMapping("amount", 1);
      store.updateMapping("description", 2);

      const { mapping } = useExcelImportStore.getState();
      expect(mapping.transacted_at).toBe(0);
      expect(mapping.amount).toBe(1);
      expect(mapping.description).toBe(2);
      expect(mapping.type).toBeNull();
    });
  });

  describe("confirmImport", () => {
    beforeEach(() => {
      useExcelImportStore.setState({
        step: "preview",
        importId: "test-import-id",
        mapping: { ...INITIAL_STATE.mapping, transacted_at: 0, amount: 1 },
      });
    });

    it("sets done state with result on success", async () => {
      const importResult = {
        created_count: 5,
        duplicate_count: 2,
        error_count: 1,
        errors: [{ row: 3, message: "날짜를 파싱할 수 없습니다." }],
      };
      mockPost.mockResolvedValueOnce({ data: importResult });

      await useExcelImportStore.getState().confirmImport();

      const state = useExcelImportStore.getState();
      expect(state.step).toBe("done");
      expect(state.result).toEqual(importResult);
      expect(state.result!.created_count).toBe(5);
      expect(state.result!.duplicate_count).toBe(2);
    });

    it("sets error state on failure", async () => {
      mockPost.mockRejectedValueOnce({
        response: { data: { detail: "미리보기가 만료되었습니다." } },
      });

      await useExcelImportStore.getState().confirmImport();

      const state = useExcelImportStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("미리보기가 만료되었습니다.");
    });

    it("does nothing when importId is null", async () => {
      useExcelImportStore.setState({ importId: null });
      await useExcelImportStore.getState().confirmImport();
      // Should not have called the API
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("sends correct default_type parameter", async () => {
      mockPost.mockResolvedValueOnce({
        data: { created_count: 0, duplicate_count: 0, error_count: 0, errors: [] },
      });

      await useExcelImportStore.getState().confirmImport("income");

      expect(mockPost).toHaveBeenCalledWith("/transactions/import/confirm", {
        import_id: "test-import-id",
        mapping: expect.objectContaining({ transacted_at: 0, amount: 1 }),
        default_type: "income",
      });
    });
  });

  describe("reset", () => {
    it("restores initial state", () => {
      useExcelImportStore.setState({
        step: "done",
        importId: "some-id",
        headers: ["a", "b"],
        mapping: { ...INITIAL_STATE.mapping, transacted_at: 0 },
        previewRows: [["1", "2"]],
        totalRows: 10,
        result: { created_count: 5, duplicate_count: 0, error_count: 0, errors: [] },
        error: null,
      });

      useExcelImportStore.getState().reset();

      const state = useExcelImportStore.getState();
      expect(state.step).toBe("idle");
      expect(state.importId).toBeNull();
      expect(state.headers).toEqual([]);
      expect(state.mapping.transacted_at).toBeNull();
      expect(state.previewRows).toEqual([]);
      expect(state.totalRows).toBe(0);
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
