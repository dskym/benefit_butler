// frontend/src/screens/settings/ImportScreen.tsx
import React, { useCallback } from "react";
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
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useExcelImportStore } from "../../store/excelImportStore";
import { theme } from "../../theme";

const FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "transacted_at", label: "날짜" },
  { key: "amount", label: "금액" },
  { key: "description", label: "내역" },
  { key: "type", label: "유형" },
  { key: "category_name", label: "카테고리" },
  { key: "payment_type", label: "결제수단" },
  { key: "card_name", label: "카드" },
];

export default function ImportScreen() {
  const navigation = useNavigation<any>();
  const {
    step,
    headers,
    mapping,
    previewRows,
    totalRows,
    result,
    error,
    uploadFile,
    updateMapping,
    confirmImport,
    reset,
  } = useExcelImportStore();

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadFile(file.uri, file.name);
    } catch {
      // User cancelled or error
    }
  }, [uploadFile]);

  const handleConfirm = useCallback(() => {
    if (mapping.transacted_at === null || mapping.amount === null) {
      const msg = "날짜와 금액 컬럼은 반드시 매핑해야 합니다.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("매핑 오류", msg);
      }
      return;
    }
    confirmImport();
  }, [mapping, confirmImport]);

  const handleDone = useCallback(() => {
    reset();
    navigation.goBack();
  }, [reset, navigation]);

  const getFieldForColumn = (colIdx: number): string | null => {
    for (const field of FIELD_OPTIONS) {
      if ((mapping as any)[field.key] === colIdx) return field.label;
    }
    return null;
  };

  const cycleMapping = (colIdx: number) => {
    const currentField = FIELD_OPTIONS.find(
      (f) => (mapping as any)[f.key] === colIdx
    );
    const currentIdx = currentField
      ? FIELD_OPTIONS.indexOf(currentField)
      : -1;

    // If we're at the last field or unmapped, cycle: unmapped → first field → second → ... → unmapped
    if (currentField) {
      // Clear current mapping
      updateMapping(currentField.key as any, null);
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx < FIELD_OPTIONS.length) {
      const nextField = FIELD_OPTIONS[nextIdx];
      // If this field is already mapped to another column, skip to next
      if ((mapping as any)[nextField.key] !== null) {
        // Find next unmapped field
        for (let i = nextIdx; i < FIELD_OPTIONS.length; i++) {
          if ((mapping as any)[FIELD_OPTIONS[i].key] === null) {
            updateMapping(FIELD_OPTIONS[i].key as any, colIdx);
            return;
          }
        }
      } else {
        updateMapping(nextField.key as any, colIdx);
      }
    }
    // else: stays unmapped (cleared above)
  };

  // ── Step: idle or uploading ──
  if (step === "idle" || step === "uploading") {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons
            name="document-outline"
            size={64}
            color={theme.colors.text.hint}
          />
          <Text style={styles.title}>Excel 파일 가져오기</Text>
          <Text style={styles.subtitle}>
            은행이나 카드사에서 내보낸{"\n"}.xlsx 파일을 선택해 주세요
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, step === "uploading" && styles.disabledButton]}
            onPress={pickFile}
            disabled={step === "uploading"}
            activeOpacity={0.8}
          >
            {step === "uploading" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>파일 선택</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step: error ──
  if (step === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={theme.colors.expense}
          />
          <Text style={styles.title}>오류 발생</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step: done ──
  if (step === "done" && result) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons
            name="checkmark-circle-outline"
            size={64}
            color={theme.colors.income}
          />
          <Text style={styles.title}>가져오기 완료</Text>
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>추가됨</Text>
              <Text style={[styles.resultValue, { color: theme.colors.income }]}>
                {result.created_count}건
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>중복 건너뜀</Text>
              <Text style={[styles.resultValue, { color: theme.colors.transfer }]}>
                {result.duplicate_count}건
              </Text>
            </View>
            {result.error_count > 0 && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>오류</Text>
                <Text style={[styles.resultValue, { color: theme.colors.expense }]}>
                  {result.error_count}건
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>완료</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step: preview / confirming ──
  return (
    <View style={styles.container}>
      <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
        {/* Summary */}
        <Text style={styles.previewTitle}>
          총 {totalRows}행 중 미리보기 (최대 10행)
        </Text>

        {/* Horizontal scroll table */}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row with mapping badges */}
            <View style={styles.tableRow}>
              {headers.map((h, i) => {
                const mapped = getFieldForColumn(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.tableCell, styles.headerCell]}
                    onPress={() => cycleMapping(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.headerText} numberOfLines={1}>
                      {h}
                    </Text>
                    {mapped ? (
                      <View style={styles.mappingBadge}>
                        <Text style={styles.mappingBadgeText}>{mapped}</Text>
                      </View>
                    ) : (
                      <Text style={styles.unmappedText}>탭하여 매핑</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Data rows */}
            {previewRows.map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                {headers.map((_, ci) => (
                  <View key={ci} style={styles.tableCell}>
                    <Text style={styles.cellText} numberOfLines={1}>
                      {row[ci] ?? ""}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Mapping summary */}
        <View style={styles.mappingSummary}>
          <Text style={styles.mappingSummaryTitle}>컬럼 매핑</Text>
          {FIELD_OPTIONS.map((f) => {
            const idx = (mapping as any)[f.key];
            return (
              <View key={f.key} style={styles.mappingRow}>
                <Text style={styles.mappingLabel}>
                  {f.label}
                  {(f.key === "transacted_at" || f.key === "amount") && (
                    <Text style={{ color: theme.colors.expense }}> *</Text>
                  )}
                </Text>
                <Text
                  style={[
                    styles.mappingValue,
                    idx === null && { color: theme.colors.text.hint },
                  ]}
                >
                  {idx !== null ? headers[idx] : "미지정"}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom action button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { flex: 1 },
            step === "confirming" && styles.disabledButton,
          ]}
          onPress={handleConfirm}
          disabled={step === "confirming"}
          activeOpacity={0.8}
        >
          {step === "confirming" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>가져오기</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.md,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.expense,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    alignItems: "center",
    minWidth: 160,
  },
  disabledButton: { backgroundColor: theme.colors.border },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Result
  resultCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: "100%",
    maxWidth: 300,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
  },
  resultLabel: { fontSize: 15, color: theme.colors.text.secondary },
  resultValue: { fontSize: 15, fontWeight: "700" },

  // Preview
  previewScroll: { flex: 1 },
  previewContent: { padding: theme.spacing.md, paddingBottom: 100 },
  previewTitle: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  tableRow: { flexDirection: "row" },
  tableCell: {
    width: 120,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  headerCell: {
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  cellText: { fontSize: 13, color: theme.colors.text.secondary },
  mappingBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  mappingBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  unmappedText: {
    fontSize: 10,
    color: theme.colors.text.hint,
    marginTop: 4,
  },

  // Mapping summary
  mappingSummary: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  mappingSummaryTitle: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  mappingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  mappingLabel: { fontSize: 14, color: theme.colors.text.primary },
  mappingValue: { fontSize: 14, color: theme.colors.primary, fontWeight: "600" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
  },
});
