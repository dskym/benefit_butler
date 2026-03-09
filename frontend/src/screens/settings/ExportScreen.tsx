// frontend/src/screens/settings/ExportScreen.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { theme } from "../../theme";

type Period = "month" | "year" | "all";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function ExportScreen() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: Record<string, string | number> = { period };
      if (period === "month" || period === "year") params.year = year;
      if (period === "month") params.month = month;

      if (Platform.OS === "web") {
        const resp = await apiClient.get("/transactions/export", {
          params,
          responseType: "blob",
        });
        const blob = new Blob([resp.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        let filename = "transactions";
        if (period === "month") filename = `transactions_${year}_${String(month).padStart(2, "0")}`;
        else if (period === "year") filename = `transactions_${year}`;
        a.download = `${filename}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Native: download + share
        const FileSystem = await import("expo-file-system");
        const Sharing = await import("expo-sharing");

        const queryString = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join("&");

        // Get the auth token for the download
        const token = await apiClient.defaults.headers.common["Authorization"];
        let authHeader = "";
        // The interceptor adds the header per-request, so we need to get it from storage
        // Use a workaround: make a HEAD-like request to get the token
        const tokenResp = await apiClient.get("/transactions/export", {
          params,
          responseType: "arraybuffer",
        });

        // expo-file-system approach: write the response data to a file
        const base64Data = arrayBufferToBase64(tokenResp.data);
        let filename = "transactions";
        if (period === "month") filename = `transactions_${year}_${String(month).padStart(2, "0")}`;
        else if (period === "year") filename = `transactions_${year}`;

        const fileUri = FileSystem.documentDirectory + `${filename}.xlsx`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "거래 내역 내보내기",
          });
        }
      }

      if (Platform.OS !== "web") {
        useToastStore.getState().showToast("엑셀 파일이 저장되었습니다.");
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || "내보내기에 실패했습니다.";
      if (Platform.OS === "web") {
        window.alert(errMsg);
      } else {
        Alert.alert("오류", errMsg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Period selection */}
      <Text style={styles.sectionLabel}>기간 선택</Text>
      <View style={styles.periodRow}>
        {(
          [
            { key: "month", label: "이번 달" },
            { key: "year", label: "올해" },
            { key: "all", label: "전체" },
          ] as const
        ).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.periodChip,
              period === item.key && styles.periodChipActive,
            ]}
            onPress={() => setPeriod(item.key)}
            activeOpacity={0.7}
            accessibilityLabel={`기간: ${item.label}`}
          >
            <Text
              style={[
                styles.periodChipText,
                period === item.key && styles.periodChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Year selector */}
      {(period === "month" || period === "year") && (
        <>
          <Text style={styles.sectionLabel}>연도</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.chip, year === y && styles.chipActive]}
                onPress={() => setYear(y)}
                activeOpacity={0.7}
                accessibilityLabel={`연도: ${y}년`}
              >
                <Text
                  style={[
                    styles.chipText,
                    year === y && styles.chipTextActive,
                  ]}
                >
                  {y}년
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Month selector */}
      {period === "month" && (
        <>
          <Text style={styles.sectionLabel}>월</Text>
          <View style={styles.monthGrid}>
            {MONTHS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthChip, month === m && styles.chipActive]}
                onPress={() => setMonth(m)}
                activeOpacity={0.7}
                accessibilityLabel={`월: ${m}월`}
              >
                <Text
                  style={[
                    styles.chipText,
                    month === m && styles.chipTextActive,
                  ]}
                >
                  {m}월
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Export button */}
      <TouchableOpacity
        style={[styles.exportButton, isExporting && styles.disabledButton]}
        onPress={handleExport}
        disabled={isExporting}
        activeOpacity={0.7}
        accessibilityLabel="내보내기"
      >
        {isExporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>내보내기</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  periodRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  periodChip: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.secondary,
  },
  periodChipTextActive: { color: "#fff" },
  chipScroll: { marginBottom: theme.spacing.sm },
  chip: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: { fontSize: 14, color: theme.colors.text.secondary },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  monthChip: {
    width: "23%",
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  exportButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  disabledButton: { backgroundColor: theme.colors.border },
  exportButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
