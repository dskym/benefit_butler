// frontend/src/screens/transactions/TransactionListScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTransactionStore } from "../../store/transactionStore";
import { useCategoryStore } from "../../store/categoryStore";
import { Transaction } from "../../types";

type TransactionType = "income" | "expense" | "transfer";

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const TYPE_COLORS: Record<TransactionType, string> = {
  income: "#22c55e",
  expense: "#ef4444",
  transfer: "##3b82f6",
};

const AMOUNT_COLORS: Record<TransactionType, string> = {
  income: "#22c55e",
  expense: "#ef4444",
  transfer: "#6b7280",
};

function formatAmount(type: TransactionType, amount: number): string {
  const formatted = amount.toLocaleString("ko-KR");
  if (type === "income") return `+${formatted}원`;
  if (type === "expense") return `-${formatted}원`;
  return `${formatted}원`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalISODate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 폼 모달 ──────────────────────────────────────────────
interface FormModalProps {
  visible: boolean;
  initial?: Transaction | null;
  onClose: () => void;
  onSubmit: (
    type: TransactionType,
    amount: string,
    description: string,
    categoryId: string,
    date: string
  ) => Promise<void>;
}

function FormModal({ visible, initial, onClose, onSubmit }: FormModalProps) {
  const { categories } = useCategoryStore();

  const [type, setType] = useState<TransactionType>((initial?.type as TransactionType) ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [date, setDate] = useState(initial ? toLocalISODate(initial.transacted_at) : toLocalISODate(new Date().toISOString()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setType((initial?.type as TransactionType) ?? "expense");
      setAmount(initial ? String(initial.amount) : "");
      setDescription(initial?.description ?? "");
      setCategoryId(initial?.category_id ?? "");
      setDate(initial ? toLocalISODate(initial.transacted_at) : toLocalISODate(new Date().toISOString()));
    }
  }, [visible, initial]);

  const handleSubmit = async () => {
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("오류", "올바른 금액을 입력해주세요.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("오류", "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(type, amount.trim(), description.trim(), categoryId, date);
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
            <Text style={styles.sheetTitle}>{initial ? "내역 수정" : "내역 추가"}</Text>

            <Text style={styles.label}>종류</Text>
            <View style={styles.typeRow}>
              {(["income", "expense", "transfer"] as TransactionType[]).map((t) => (
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

            <Text style={styles.label}>금액 (원)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="예: 15000"
              keyboardType="numeric"
            />

            <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2024-01-01"
              autoCapitalize="none"
            />

            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 점심 식사"
            />

            <Text style={styles.label}>카테고리 (선택)</Text>
            <TouchableOpacity
              style={[styles.input, styles.categorySelector]}
              onPress={() => setCategoryId("")}
            >
              <Text style={categoryId ? styles.categorySelectorText : styles.categorySelectorPlaceholder}>
                {categoryId
                  ? categories.find((c) => c.id === categoryId)?.name ?? "카테고리 선택"
                  : "없음"}
              </Text>
            </TouchableOpacity>
            <View style={styles.categoryList}>
              <TouchableOpacity
                style={[styles.categoryChip, !categoryId && styles.categoryChipSelected]}
                onPress={() => setCategoryId("")}
              >
                <Text style={[styles.categoryChipText, !categoryId && styles.categoryChipSelectedText]}>
                  없음
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.categoryChip,
                    categoryId === c.id && styles.categoryChipSelected,
                    categoryId === c.id && { borderColor: c.color ?? "#4F46E5" },
                  ]}
                  onPress={() => setCategoryId(c.id)}
                >
                  {c.color && (
                    <View style={[styles.categoryChipDot, { backgroundColor: c.color }]} />
                  )}
                  <Text
                    style={[
                      styles.categoryChipText,
                      categoryId === c.id && styles.categoryChipSelectedText,
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
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
export default function TransactionListScreen() {
  const { transactions, isLoading, fetchTransactions, createTransaction, updateTransaction, deleteTransaction } =
    useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (item: Transaction) => {
    setEditing(item);
    setModalVisible(true);
  };

  const handleDelete = (item: Transaction) => {
    const doDelete = () => deleteTransaction(item.id);
    if (Platform.OS === "web") {
      if (window.confirm(`이 내역을 삭제할까요?`)) doDelete();
    } else {
      Alert.alert("삭제", "이 내역을 삭제할까요?", [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleSubmit = async (
    type: TransactionType,
    amount: string,
    description: string,
    categoryId: string,
    date: string
  ) => {
    const payload = {
      type,
      amount: Number(amount),
      description: description || undefined,
      category_id: categoryId || undefined,
      transacted_at: new Date(date).toISOString(),
    };
    if (editing) {
      await updateTransaction(editing.id, payload);
    } else {
      await createTransaction(payload);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowType, { color: TYPE_COLORS[item.type as TransactionType] }]}>
          {TYPE_LABELS[item.type as TransactionType]}
        </Text>
        <Text style={styles.rowDate}>{formatDate(item.transacted_at)}</Text>
      </View>
      <View style={styles.rowInfo}>
        {item.description ? (
          <Text style={styles.rowDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        {getCategoryName(item.category_id) && (
          <Text style={styles.rowCategory}>{getCategoryName(item.category_id)}</Text>
        )}
      </View>
      <Text style={[styles.rowAmount, { color: AMOUNT_COLORS[item.type as TransactionType] }]}>
        {formatAmount(item.type as TransactionType, item.amount)}
      </Text>
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
        <Text style={styles.title}>거래 내역</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>거래 내역이 없습니다. 추가해보세요!</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  rowLeft: { width: 52, marginRight: 8 },
  rowType: { fontSize: 12, fontWeight: "600" },
  rowDate: { fontSize: 11, color: "#999", marginTop: 2 },
  rowInfo: { flex: 1 },
  rowDescription: { fontSize: 15, color: "#111" },
  rowCategory: { fontSize: 12, color: "#888", marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: "600", marginRight: 4 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  editBtnText: { color: "#4F46E5", fontSize: 13 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  deleteBtnText: { color: "#ef4444", fontSize: 13 },
  empty: { textAlign: "center", color: "#999", marginTop: 60, fontSize: 15 },
  // 모달
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: "90%",
  },
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
  categorySelector: { justifyContent: "center" },
  categorySelectorText: { fontSize: 15, color: "#111" },
  categorySelectorPlaceholder: { fontSize: 15, color: "#aaa" },
  categoryList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  categoryChipSelected: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  categoryChipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryChipText: { fontSize: 13, color: "#555" },
  categoryChipSelectedText: { color: "#4F46E5", fontWeight: "600" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
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
