// frontend/src/store/excelImportStore.ts
import { create } from "zustand";
import { apiClient } from "../services/api";
import { Platform } from "react-native";

interface ColumnMapping {
  transacted_at: number | null;
  amount: number | null;
  description: number | null;
  type: number | null;
  category_name: number | null;
  payment_type: number | null;
  card_name: number | null;
}

interface ImportResult {
  created_count: number;
  duplicate_count: number;
  error_count: number;
  errors: { row: number; message: string }[];
}

interface ExcelImportState {
  step: "idle" | "uploading" | "preview" | "confirming" | "done" | "error";
  importId: string | null;
  headers: string[];
  mapping: ColumnMapping;
  previewRows: (string | null)[][];
  totalRows: number;
  result: ImportResult | null;
  error: string | null;

  uploadFile: (fileUri: string, fileName: string) => Promise<void>;
  updateMapping: (field: keyof ColumnMapping, columnIndex: number | null) => void;
  confirmImport: (defaultType?: string) => Promise<void>;
  reset: () => void;
}

const INITIAL_MAPPING: ColumnMapping = {
  transacted_at: null,
  amount: null,
  description: null,
  type: null,
  category_name: null,
  payment_type: null,
  card_name: null,
};

const INITIAL_STATE = {
  step: "idle" as const,
  importId: null,
  headers: [],
  mapping: { ...INITIAL_MAPPING },
  previewRows: [],
  totalRows: 0,
  result: null,
  error: null,
};

export const useExcelImportStore = create<ExcelImportState>()((set, get) => ({
  ...INITIAL_STATE,

  uploadFile: async (fileUri: string, fileName: string) => {
    set({ step: "uploading", error: null });
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        // Web: fileUri is a blob URL, fetch it and append
        const resp = await fetch(fileUri);
        const blob = await resp.blob();
        formData.append("file", blob, fileName);
      } else {
        // Native: use the uri directly
        const mimeType = fileName.toLowerCase().endsWith(".xls") && !fileName.toLowerCase().endsWith(".xlsx")
          ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        formData.append("file", {
          uri: fileUri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const { data } = await apiClient.post("/transactions/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      set({
        step: "preview",
        importId: data.import_id,
        headers: data.headers,
        mapping: data.auto_mapping,
        previewRows: data.preview_rows,
        totalRows: data.total_rows,
      });
    } catch (e: any) {
      set({
        step: "error",
        error: e.response?.data?.detail || "파일 업로드에 실패했습니다.",
      });
    }
  },

  updateMapping: (field, columnIndex) => {
    set((s) => ({
      mapping: { ...s.mapping, [field]: columnIndex },
    }));
  },

  confirmImport: async (defaultType = "expense") => {
    const { importId, mapping } = get();
    if (!importId) return;

    set({ step: "confirming", error: null });
    try {
      const { data } = await apiClient.post("/transactions/import/confirm", {
        import_id: importId,
        mapping,
        default_type: defaultType,
      });
      set({ step: "done", result: data });
    } catch (e: any) {
      set({
        step: "error",
        error: e.response?.data?.detail || "가져오기에 실패했습니다.",
      });
    }
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
