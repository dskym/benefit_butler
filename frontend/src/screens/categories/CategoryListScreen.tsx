// frontend/src/screens/categories/CategoryListScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCategoryStore } from "../../store/categoryStore";
import { Category } from "../../types";

type CategoryType = "income" | "expense" | "transfer";

const TYPE_LABELS: Record<CategoryType, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const TYPE_COLORS: Record<CategoryType, string> = {
  income: "#22c55e",
  expense: "#ef4444",
  transfer: "#3b82f6",
};

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
          <Text style={styles.sheetTitle}>{initial ? "카테고리 수정" : "카테고리 추가"}</Text>

          <Text style={styles.label}>이름</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="예: 식비"
          />

          <Text style={styles.label}>종류</Text>
          <View style={styles.typeRow}>
            {(["income", "expense", "transfer"] as CategoryType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && { backgroundColor: TYPE_COLORS[t] }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeBtnText, type === t && { color: "#fff" }]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>색상 (hex)</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="#6366f1"
            autoCapitalize="none"
          />

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

  const renderItem = ({ item }: { item: Category }) => (
    <View style={styles.row}>
      <View style={[styles.colorDot, { backgroundColor: item.color ?? "#ccc" }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={[styles.rowType, { color: TYPE_COLORS[item.type as CategoryType] }]}>
          {TYPE_LABELS[item.type as CategoryType]}
        </Text>
      </View>
      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
        <Text style={styles.editBtnText}>수정</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteBtnText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>카테고리</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>카테고리가 없습니다. 추가해보세요!</Text>
          }
        />
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: { fontSize: 20, fontWeight: "bold" },
  addBtn: { backgroundColor: "#4F46E5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16 },
  rowType: { fontSize: 12, marginTop: 2 },
  editBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: "#4F46E5", fontSize: 14 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteBtnText: { color: "#ef4444", fontSize: 14 },
  empty: { textAlign: "center", color: "#999", marginTop: 60, fontSize: 15 },
  // 모달
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  sheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  typeBtnText: { fontSize: 14, color: "#555" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelBtnText: { color: "#555", fontSize: 15 },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
