// frontend/src/screens/transactions/TransactionListScreen.tsx
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
import { useTransactionStore } from "../../store/transactionStore";
import { useCategoryStore } from "../../store/categoryStore";
import { Transaction } from "../../types";
import { theme } from "../../theme";

type TransactionType = "income" | "expense" | "transfer";
type FilterType = "all" | TransactionType;

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const TYPE_COLORS: Record<TransactionType, string> = {
  income: theme.colors.income,
  expense: theme.colors.expense,
  transfer: theme.colors.transfer,
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

function sectionTitle(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
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
  const [date, setDate] = useState(
    initial ? toLocalISODate(initial.transacted_at) : toLocalISODate(new Date().toISOString())
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setType((initial?.type as TransactionType) ?? "expense");
      setAmount(initial ? String(initial.amount) : "");
      setDescription(initial?.description ?? "");
      setCategoryId(initial?.category_id ?? "");
      setDate(
        initial ? toLocalISODate(initial.transacted_at) : toLocalISODate(new Date().toISOString())
      );
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
                    categoryId === c.id && { borderColor: c.color ?? theme.colors.primary },
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
  const {
    transactions,
    isLoading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

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
      if (window.confirm("이 내역을 삭제할까요?")) doDelete();
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

  const getCategoryName = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId)?.name ?? null;

  // 필터 적용
  const filtered = useMemo(
    () =>
      filter === "all"
        ? transactions
        : transactions.filter((t) => t.type === filter),
    [transactions, filter]
  );

  // 월별 섹션 그룹화
  const sections = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
    );
    const map = new Map<string, Transaction[]>();
    for (const tx of sorted) {
      const key = sectionTitle(tx.transacted_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "income", label: "수입" },
    { key: "expense", label: "지출" },
    { key: "transfer", label: "이체" },
  ];

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>거래 내역</Text>
      </View>

      {/* 필터 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.typeDot, { backgroundColor: TYPE_COLORS[item.type as TransactionType] }]} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowDescription} numberOfLines={1}>
                  {item.description ?? TYPE_LABELS[item.type as TransactionType]}
                </Text>
                {getCategoryName(item.category_id) && (
                  <Text style={styles.rowCategory}>{getCategoryName(item.category_id)}</Text>
                )}
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowAmount, { color: TYPE_COLORS[item.type as TransactionType] }]}>
                  {formatAmount(item.type as TransactionType, item.amount)}
                </Text>
                <Text style={styles.rowDate}>{formatDate(item.transacted_at)}</Text>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                  <Text style={styles.editBtnText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>거래 내역이 없습니다. 추가해보세요!</Text>
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* 플로팅 추가 버튼 */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

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
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { ...theme.typography.h2, color: theme.colors.text.primary },
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
  filterScroll: { backgroundColor: theme.colors.bg, maxHeight: 52 },
  filterContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterTabText: { fontSize: 14, color: theme.colors.text.secondary, fontWeight: "500" },
  filterTabTextActive: { color: "#fff", fontWeight: "700" },
  sectionHeader: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text.secondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing.sm },
  rowInfo: { flex: 1 },
  rowDescription: { fontSize: 15, fontWeight: "600", color: theme.colors.text.primary },
  rowCategory: { ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 },
  rowRight: { alignItems: "flex-end", marginRight: theme.spacing.sm },
  rowAmount: { fontSize: 15, fontWeight: "600" },
  rowDate: { ...theme.typography.caption, color: theme.colors.text.hint, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 4 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { color: theme.colors.primary, fontSize: 13 },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { color: theme.colors.expense, fontSize: 13 },
  empty: {
    textAlign: "center",
    color: theme.colors.text.hint,
    marginTop: 60,
    fontSize: 15,
  },
  // 모달
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "90%",
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
  categoryList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryChipSelected: { borderColor: theme.colors.primary, backgroundColor: "#EEF5FF" },
  categoryChipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryChipText: { fontSize: 13, color: theme.colors.text.secondary },
  categoryChipSelectedText: { color: theme.colors.primary, fontWeight: "600" },
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
