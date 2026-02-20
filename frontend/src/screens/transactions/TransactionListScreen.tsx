// frontend/src/screens/transactions/TransactionListScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
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
import { theme } from "../../theme";

// ── 상수 ─────────────────────────────────────────────────

// Legacy: kept for display of existing transfer records
const TYPE_LABELS: Record<string, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const TYPE_COLORS: Record<string, string> = {
  income: theme.colors.income,
  expense: theme.colors.expense,
  transfer: theme.colors.transfer,
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 유틸 ─────────────────────────────────────────────────

function toLocalISODate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 달력 셀 배열: null = 앞 빈칸 패딩
function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=일
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
  return cells;
}

function formatAmount(type: string, amount: number): string {
  const formatted = Math.round(Number(amount) || 0).toLocaleString("ko-KR");
  if (type === "income") return `+${formatted}원`;
  if (type === "expense") return `-${formatted}원`;
  return `${formatted}원`;
}


// ── FormModal ─────────────────────────────────────────────

interface FormModalProps {
  visible: boolean;
  initial?: Transaction | null;
  initialDate?: string;
  onClose: () => void;
  onSubmit: (
    type: "income" | "expense",
    amount: string,
    description: string,
    categoryId: string,
    date: string
  ) => Promise<void>;
}

function FormModal({ visible, initial, initialDate, onClose, onSubmit }: FormModalProps) {
  const { categories } = useCategoryStore();

  const defaultType: "income" | "expense" =
    initial?.type === "income" ? "income" : "expense";

  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState(initial ? String(Math.round(Number(initial.amount))) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [date, setDate] = useState(
    initial
      ? toLocalISODate(initial.transacted_at)
      : initialDate ?? todayKey()
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setType(initial?.type === "income" ? "income" : "expense");
      setAmount(initial ? String(Math.round(Number(initial.amount))) : "");
      setDescription(initial?.description ?? "");
      setCategoryId(initial?.category_id ?? "");
      setDate(
        initial
          ? toLocalISODate(initial.transacted_at)
          : initialDate ?? todayKey()
      );
    }
  }, [visible, initial, initialDate]);

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

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleTypeChange = (newType: "income" | "expense") => {
    setType(newType);
    setCategoryId("");
  };

  const FORM_TYPES: { key: "income" | "expense"; label: string; color: string }[] = [
    { key: "income", label: "수입", color: theme.colors.income },
    { key: "expense", label: "지출", color: theme.colors.expense },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>{initial ? "내역 수정" : "내역 추가"}</Text>

            {/* Step 1: type selector — income/expense only */}
            <Text style={styles.label}>종류</Text>
            <View style={styles.typeRow}>
              {FORM_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.typeBtn,
                    type === t.key && { backgroundColor: t.color, borderColor: t.color },
                  ]}
                  onPress={() => handleTypeChange(t.key)}
                >
                  <Text style={[styles.typeBtnText, type === t.key && { color: "#fff" }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>금액 (원)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
              placeholder="예: 15000"
              placeholderTextColor={theme.colors.text.hint}
              keyboardType="numeric"
            />

            <Text style={styles.label}>날짜 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2024-01-01"
              placeholderTextColor={theme.colors.text.hint}
              autoCapitalize="none"
            />

            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="예: 점심 식사"
              placeholderTextColor={theme.colors.text.hint}
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
              {filteredCategories.map((c) => (
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
              {filteredCategories.length === 0 && (
                <Text style={styles.noCategoryText}>
                  {type === "income" ? "수입" : "지출"} 카테고리가 없습니다.
                </Text>
              )}
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

  // Step 2: calendar state
  const today = useMemo(() => todayKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(today);

  // Step 4: modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth(); // 0-indexed
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Step 2: calendar cells array
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  // Step 2: dot map — date → { income, expense }
  const txDayMap = useMemo(() => {
    const map: Record<string, { income: boolean; expense: boolean }> = {};
    transactions
      .filter((t) => t.transacted_at.startsWith(monthKey))
      .forEach((t) => {
        const day = toLocalISODate(t.transacted_at);
        if (!map[day]) map[day] = { income: false, expense: false };
        if (t.type === "income") map[day].income = true;
        if (t.type === "expense") map[day].expense = true;
      });
    return map;
  }, [transactions, monthKey]);

  // Step 3: filtered transaction list
  const listTx = useMemo(() => {
    const monthFiltered = transactions.filter((t) =>
      t.transacted_at.startsWith(monthKey)
    );
    const dayFiltered = selectedDay
      ? monthFiltered.filter((t) => toLocalISODate(t.transacted_at) === selectedDay)
      : monthFiltered;
    return [...dayFiltered].sort(
      (a, b) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
    );
  }, [transactions, monthKey, selectedDay]);

  // Step 2: day summary bar data
  const daySummary = useMemo(() => {
    const income = listTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const expense = listTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { income, expense };
  }, [listTx]);

  // Month navigation — resets selectedDay
  const prevMonth = () => {
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  // Step 2: day press — same day re-tap deselects
  const handleDayPress = (dateStr: string) => {
    setSelectedDay((prev) => (prev === dateStr ? null : dateStr));
  };

  // Step 4: FAB opens create with selectedDay pre-filled
  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (item: Transaction) => {
    setEditing(item);
    setModalVisible(true);
  };

  // Step 3: delete handler
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
    type: "income" | "expense",
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

  // Step 2: summary bar label
  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return `${month + 1}월 전체`;
    const d = new Date(selectedDay);
    return `${month + 1}월 ${d.getDate()}일 · ${WEEKDAYS[d.getDay()]}`;
  }, [selectedDay, month]);

  // Step 2: calendar cell renderer
  const renderCalendarCell = (item: Date | null, index: number) => {
    if (!item) {
      return <View key={`empty-${index}`} style={styles.calCell} />;
    }
    const dateStr = dateToKey(item);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDay;
    const dots = txDayMap[dateStr];

    return (
      <TouchableOpacity
        key={dateStr}
        style={styles.calCell}
        onPress={() => handleDayPress(dateStr)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.calDayCircle,
            isToday && !isSelected && styles.calDayToday,
            isSelected && styles.calDaySelected,
          ]}
        >
          <Text
            style={[
              styles.calDayText,
              isSelected && styles.calDayTextSelected,
              isToday && !isSelected && styles.calDayTextToday,
              item.getDay() === 0 && !isSelected && styles.calDayTextSun,
              item.getDay() === 6 && !isSelected && styles.calDayTextSat,
            ]}
          >
            {item.getDate()}
          </Text>
        </View>
        <View style={styles.calDotRow}>
          {dots?.income && (
            <View style={[styles.calDot, { backgroundColor: theme.colors.income }]} />
          )}
          {dots?.expense && (
            <View style={[styles.calDot, { backgroundColor: theme.colors.expense }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Step 2: Calendar section (fixed top) */}
      <View style={styles.calendarSection}>
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth} activeOpacity={0.7}>
            <Text style={styles.monthNavArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSelectedMonth(new Date());
              setSelectedDay(today);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.monthNavTitle}>
              {year}년 {month + 1}월
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth} activeOpacity={0.7}>
            <Text style={styles.monthNavArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday header */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Text
              key={d}
              style={[
                styles.weekdayText,
                i === 0 && styles.weekdayTextSun,
                i === 6 && styles.weekdayTextSat,
              ]}
            >
              {d}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calGrid}>
          {calendarDays.map((d, i) => renderCalendarCell(d, i))}
        </View>

        {/* Day summary bar */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryDateText}>{selectedDayLabel}</Text>
          <View style={styles.summaryAmounts}>
            <Text style={[styles.summaryAmount, { color: theme.colors.income }]}>
              수입 {Math.round(daySummary.income).toLocaleString("ko-KR")}원
            </Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>
              지출 {Math.round(daySummary.expense).toLocaleString("ko-KR")}원
            </Text>
          </View>
        </View>
      </View>

      {/* Step 3: Transaction list (scrollable) */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listTx}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const typeColor = TYPE_COLORS[item.type] ?? theme.colors.transfer;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => openEdit(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {item.description ?? TYPE_LABELS[item.type] ?? item.type}
                  </Text>
                  {getCategoryName(item.category_id) && (
                    <Text style={styles.rowCategory}>
                      {getCategoryName(item.category_id)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.rowAmount, { color: typeColor }]}>
                  {formatAmount(item.type, item.amount)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {selectedDay ? "이 날 거래 내역이 없습니다." : "이 달 거래 내역이 없습니다."}
            </Text>
          }
        />
      )}

      {/* Step 4: FAB — pre-fills selectedDay */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Step 4: FormModal with initialDate */}
      <FormModal
        visible={modalVisible}
        initial={editing}
        initialDate={editing ? undefined : (selectedDay ?? today)}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

// ── 스타일 ────────────────────────────────────────────────

const CAL_CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },

  // Calendar
  calendarSection: {
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  monthNavBtn: { padding: 8 },
  monthNavArrow: {
    fontSize: 26,
    color: theme.colors.text.secondary,
    fontWeight: "300",
    lineHeight: 30,
  },
  monthNavTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    paddingVertical: 4,
  },
  weekdayTextSun: { color: theme.colors.expense },
  weekdayTextSat: { color: theme.colors.primary },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calCell: {
    width: `${100 / 7}%` as any,
    alignItems: "center",
    paddingVertical: 3,
  },
  calDayCircle: {
    width: CAL_CELL_SIZE,
    height: CAL_CELL_SIZE,
    borderRadius: CAL_CELL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  calDaySelected: {
    backgroundColor: theme.colors.primary,
  },
  calDayText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  calDayTextSelected: { color: "#fff", fontWeight: "700" },
  calDayTextToday: { color: theme.colors.primary, fontWeight: "700" },
  calDayTextSun: { color: theme.colors.expense },
  calDayTextSat: { color: theme.colors.primary },
  calDotRow: {
    flexDirection: "row",
    gap: 2,
    height: 6,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryDateText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  summaryAmounts: { flexDirection: "row", gap: theme.spacing.sm },
  summaryAmount: { fontSize: 13, fontWeight: "700" },
  summaryEmpty: { fontSize: 13, color: theme.colors.text.hint },

  // List
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 100,
  },
  separator: { height: 1, backgroundColor: theme.colors.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing.sm },
  rowInfo: { flex: 1 },
  rowDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  rowCategory: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  rowAmount: { fontSize: 15, fontWeight: "600", marginRight: theme.spacing.sm },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { color: theme.colors.expense, fontSize: 13 },
  empty: {
    textAlign: "center",
    color: theme.colors.text.hint,
    marginTop: 40,
    fontSize: 15,
  },

  // FAB
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

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "90%",
  },
  sheetTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginBottom: 20,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
  },
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
  categoryChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#EEF5FF",
  },
  categoryChipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryChipText: { fontSize: 13, color: theme.colors.text.secondary },
  categoryChipSelectedText: { color: theme.colors.primary, fontWeight: "600" },
  noCategoryText: { fontSize: 13, color: theme.colors.text.hint },
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
