// frontend/src/screens/categories/CategoryListScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCategoryStore } from "../../store/categoryStore";
import { Category } from "../../types";
import { theme } from "../../theme";

type CategoryType = "income" | "expense" | "transfer";

const TYPE_LABELS: Record<CategoryType, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const TYPE_COLORS: Record<CategoryType, string> = {
  income: theme.colors.income,
  expense: theme.colors.expense,
  transfer: theme.colors.transfer,
};

// 타입별 섹션 순서
const TYPE_ORDER: CategoryType[] = ["income", "expense", "transfer"];

// ── 폼 모달 ──────────────────────────────────────────────
interface FormModalProps {
  visible: boolean;
  initial?: Category | null;
  onClose: () => void;
  onSubmit: (name: string, type: CategoryType, color: string) => Promise<void>;
}

function FormModal({ visible, initial, onClose, onSubmit }: FormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CategoryType>((initial?.type as CategoryType) ?? "expense");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? "");
      setType((initial?.type as CategoryType) ?? "expense");
      setColor(initial?.color ?? "#6366f1");
    }
  }, [visible, initial]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("오류", "카테고리 이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(name.trim(), type, color);
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? "저장에 실패했습니다.";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>{initial ? "카테고리 수정" : "카테고리 추가"}</Text>

            <Text style={styles.label}>이름</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 식비"
              placeholderTextColor={theme.colors.text.hint}
            />

            <Text style={styles.label}>종류</Text>
            <View style={styles.typeRow}>
              {(["income", "expense"] as CategoryType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    type === t && { backgroundColor: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] },
                  ]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeBtnText, type === t && { color: "#fff" }]}>
                    {TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>색상 (hex)</Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorPreview, { backgroundColor: color }]} />
              <TextInput
                style={[styles.input, styles.colorInput]}
                value={color}
                onChangeText={setColor}
                placeholder="#6366f1"
                autoCapitalize="none"
                placeholderTextColor={theme.colors.text.hint}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────
export default function CategoryListScreen() {
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory } =
    useCategoryStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (item: Category) => {
    setEditing(item);
    setModalVisible(true);
  };

  const handleDelete = (item: Category) => {
    const doDelete = () => deleteCategory(item.id);
    if (Platform.OS === "web") {
      if (window.confirm(`"${item.name}" 카테고리를 삭제할까요?`)) doDelete();
    } else {
      Alert.alert("삭제", `"${item.name}" 카테고리를 삭제할까요?`, [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleSubmit = async (name: string, type: CategoryType, color: string) => {
    if (editing) {
      await updateCategory(editing.id, { name, type, color });
    } else {
      await createCategory({ name, type, color });
    }
  };

  // 타입별 섹션 그룹화
  const sections = useMemo(() => {
    return TYPE_ORDER
      .map((type) => ({
        title: TYPE_LABELS[type],
        type,
        data: categories.filter((c) => c.type === type),
      }))
      .filter((s) => s.data.length > 0);
  }, [categories]);

  const canAddMore = useMemo(() => {
    const incomeCount = categories.filter((c) => c.type === "income").length;
    const expenseCount = categories.filter((c) => c.type === "expense").length;
    return incomeCount < 30 || expenseCount < 30;
  }, [categories]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: TYPE_COLORS[section.type] }]} />
              <Text style={styles.sectionLabel}>{section.title}</Text>
              <Text style={[
                styles.sectionCount,
                section.data.length >= 30 && { color: theme.colors.expense },
              ]}>
                {section.data.length}/30
              </Text>
            </View>
          )}
          renderSectionFooter={() => <View style={styles.sectionFooter} />}
          renderItem={({ item, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;
            return (
              <View style={[styles.row, isFirst && styles.rowFirst, isLast && styles.rowLast]}>
                <View style={[styles.colorDot, { backgroundColor: item.color ?? theme.colors.text.hint }]} />
                <Text style={styles.rowName}>{item.name}</Text>
                {!item.is_default && (
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                      <Text style={styles.editBtnText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteBtnText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>카테고리가 없습니다. 추가해보세요!</Text>
          }
        />
      )}

      {/* 플로팅 추가 버튼 */}
      {canAddMore && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <FormModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 100,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  sectionCount: {
    ...theme.typography.caption,
    color: theme.colors.text.hint,
    fontWeight: "600",
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: theme.spacing.sm },
  sectionLabel: { ...theme.typography.caption, fontWeight: "700", color: theme.colors.text.secondary },
  sectionFooter: { height: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.bg,
  },
  rowFirst: { borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  rowLast: { borderBottomLeftRadius: theme.radius.lg, borderBottomRightRadius: theme.radius.lg },
  separator: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.md },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: theme.spacing.md },
  rowName: { flex: 1, fontSize: 16, color: theme.colors.text.primary },
  rowActions: { flexDirection: "row", gap: 4 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { color: theme.colors.primary, fontSize: 13 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { color: theme.colors.expense, fontSize: 13 },
  empty: { textAlign: "center", color: theme.colors.text.hint, marginTop: 60, fontSize: 15 },
  fab: {
    position: "absolute",
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  // 모달
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "85%",
  },
  sheetTitle: { ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 20 },
  label: { ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  typeBtnText: { fontSize: 14, color: theme.colors.text.secondary },
  colorRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  colorPreview: { width: 36, height: 36, borderRadius: theme.radius.sm },
  colorInput: { flex: 1 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  cancelBtnText: { color: theme.colors.text.secondary, fontSize: 15 },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
