// frontend/src/screens/transactions/TransactionListScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useCardStore } from "../../store/cardStore";
import { Transaction } from "../../types";
import { theme } from "../../theme";
import { suggestCategory } from "../../utils/categoryKeywords";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

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

const PAYMENT_LABELS: Record<string, string> = {
  cash: "현금",
  credit_card: "신용카드",
  debit_card: "체크카드",
  bank: "은행이체",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 유틸 ─────────────────────────────────────────────────

function toLocalISODate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ISO → "YYYY-MM-DD HH:MM" (로컬 시간)
function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` +
    ` ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  );
}

// "YYYY-MM-DD HH:MM" → ISO (로컬 시간 기준)
function localDateTimeToISO(dt: string): string {
  const [datePart, timePart = "00:00"] = dt.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "YYYY-MM-DD" 날짜 키에 현재 시각을 붙여 datetime 문자열 반환
function dateKeyToDateTime(dateKey: string): string {
  const d = new Date();
  return `${dateKey} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowLocalDateTime(): string {
  return dateKeyToDateTime(todayKey());
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
  prefill?: Transaction | null;       // NEW: favorite re-entry (all fields, date = today)
  initialDate?: string;
  onClose: () => void;
  onSubmit: (
    type: "income" | "expense",
    amount: string,
    description: string,
    categoryId: string,
    datetime: string,
    paymentType: string | null,
    userCardId: string | null
  ) => Promise<void>;
}

function FormModal({ visible, initial, prefill, initialDate, onClose, onSubmit }: FormModalProps) {
  const { categories } = useCategoryStore();
  const { cards, fetchCards, createCard } = useCardStore();
  const { transactions } = useTransactionStore();

  const defaultType: "income" | "expense" =
    initial?.type === "income" ? "income" : "expense";

  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState(initial ? String(Math.round(Number(initial.amount))) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [datetime, setDatetime] = useState(
    initial
      ? toLocalDateTime(initial.transacted_at)
      : initialDate ? dateKeyToDateTime(initialDate) : nowLocalDateTime()
  );
  const [loading, setLoading] = useState(false);

  // 결제 수단 state (지출일 때만 활성)
  const [paymentType, setPaymentType] = useState<string | null>(initial?.payment_type ?? null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initial?.user_card_id ?? null);
  const [newCardName, setNewCardName] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    if (visible) {
      // src: edit target OR favorite prefill OR null (blank)
      const src = initial ?? prefill ?? null;
      setType(src?.type === "income" ? "income" : "expense");
      setAmount(src ? String(Math.round(Number(src.amount))) : "");
      setDescription(src?.description ?? "");
      setCategoryId(src?.category_id ?? "");
      setSuggestedCategoryId(null);
      // For favorite re-entry (prefill, no initial): reset date to today
      setDatetime(
        initial
          ? toLocalDateTime(initial.transacted_at)
          : initialDate ? dateKeyToDateTime(initialDate) : nowLocalDateTime()
      );
      setPaymentType(src?.type === "expense" ? (src.payment_type ?? null) : null);
      setSelectedCardId(src?.type === "expense" ? (src.user_card_id ?? null) : null);
      setNewCardName("");
      setShowAddCard(false);
      fetchCards();
    }
  }, [visible, initial, prefill, initialDate, fetchCards]);

  const handleTypeChange = (newType: "income" | "expense") => {
    setType(newType);
    setCategoryId("");
    setSuggestedCategoryId(null);
    // 수입으로 바꾸면 결제 수단 초기화
    if (newType === "income") {
      setPaymentType(null);
      setSelectedCardId(null);
      setShowAddCard(false);
    }
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (text.length < 2) {
      setSuggestedCategoryId(null);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      const suggestion = suggestCategory(text, type, transactions, categories);
      setSuggestedCategoryId(suggestion?.categoryId ?? null);
      if (suggestion) {
        // 카테고리 미선택 상태에서만 자동 선택
        setCategoryId((prev) => prev || suggestion.categoryId);
      }
    }, 150);
  };

  const handleCategorySelect = (catId: string) => {
    setCategoryId(catId);
    setSuggestedCategoryId(null);
  };

  const handlePaymentTypeChange = (pt: string) => {
    setPaymentType(pt);
    if (pt !== "credit_card" && pt !== "debit_card") {
      setSelectedCardId(null);
    }
    setShowAddCard(false);
  };

  const handleAddCard = async () => {
    const trimmed = newCardName.trim();
    if (!trimmed) return;
    if (!paymentType || (paymentType !== "credit_card" && paymentType !== "debit_card")) return;
    try {
      const newCard = await createCard({
        type: paymentType as "credit_card" | "debit_card",
        name: trimmed,
      });
      setSelectedCardId(newCard.id);
      setNewCardName("");
      setShowAddCard(false);
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "카드 추가에 실패했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("오류", "올바른 금액을 입력해주세요.");
      return;
    }
    if (!datetime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
      Alert.alert("오류", "날짜/시간 형식이 올바르지 않습니다. (YYYY-MM-DD HH:MM)");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(
        type, amount.trim(), description.trim(), categoryId, datetime,
        type === "expense" ? paymentType : null,
        type === "expense" ? selectedCardId : null
      );
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? "저장에 실패했습니다.";
      Alert.alert("오류", msg);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const filteredCards = cards.filter((c) => c.type === paymentType);
  const showCardSection = paymentType === "credit_card" || paymentType === "debit_card";

  const FORM_TYPES: { key: "income" | "expense"; label: string; color: string }[] = [
    { key: "income", label: "수입", color: theme.colors.income },
    { key: "expense", label: "지출", color: theme.colors.expense },
  ];

  const PAYMENT_TYPES: { key: string; label: string }[] = [
    { key: "cash", label: "현금" },
    { key: "credit_card", label: "신용카드" },
    { key: "debit_card", label: "체크카드" },
    { key: "bank", label: "은행이체" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>날짜 및 시간 (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={datetime}
              onChangeText={setDatetime}
              placeholder="2024-01-01 14:30"
              placeholderTextColor={theme.colors.text.hint}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />

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

            <Text style={styles.label}>메모 (가맹점명)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="가맹점명 입력 시 카테고리 자동 추천"
              placeholderTextColor={theme.colors.text.hint}
            />

            <Text style={styles.label}>카테고리 (선택)</Text>
            {!suggestedCategoryId && !categoryId && (
              <Text style={styles.categoryHint}>메모를 입력하면 카테고리를 자동 추천합니다</Text>
            )}
            <View style={styles.categoryList}>
              <TouchableOpacity
                style={[styles.categoryChip, !categoryId && styles.categoryChipSelected]}
                onPress={() => handleCategorySelect("")}
              >
                <Text style={[styles.categoryChipText, !categoryId && styles.categoryChipSelectedText]}>
                  없음
                </Text>
              </TouchableOpacity>
              {filteredCategories.map((c) => {
                const isSuggested = c.id === suggestedCategoryId;
                const isSelected = categoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                      isSelected && { borderColor: c.color ?? theme.colors.primary },
                    ]}
                    onPress={() => handleCategorySelect(c.id)}
                  >
                    {c.color && (
                      <View style={[styles.categoryChipDot, { backgroundColor: c.color }]} />
                    )}
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipSelectedText,
                      ]}
                    >
                      {c.name}
                    </Text>
                    {isSelected && isSuggested && (
                      <View style={styles.suggestBadge}>
                        <Text style={styles.suggestBadgeText}>추천</Text>
                      </View>
                    )}
                    {!isSelected && isSuggested && (
                      <Text style={styles.suggestHintText}>💡</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {filteredCategories.length === 0 && (
                <Text style={styles.noCategoryText}>
                  {type === "income" ? "수입" : "지출"} 카테고리가 없습니다.
                </Text>
              )}
            </View>

            {/* 결제 수단 — 지출일 때만 표시 */}
            {type === "expense" && (
              <>
                <Text style={styles.label}>결제 수단</Text>
                <View style={styles.paymentRow}>
                  {PAYMENT_TYPES.map((pt) => (
                    <TouchableOpacity
                      key={pt.key}
                      style={[
                        styles.paymentBtn,
                        paymentType === pt.key && styles.paymentBtnActive,
                      ]}
                      onPress={() => handlePaymentTypeChange(pt.key)}
                    >
                      <Text
                        style={[
                          styles.paymentBtnText,
                          paymentType === pt.key && styles.paymentBtnTextActive,
                        ]}
                      >
                        {pt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {showCardSection && (
                  <View style={styles.cardSection}>
                    <TouchableOpacity
                      style={styles.cardRow}
                      onPress={() => setSelectedCardId(null)}
                    >
                      <View style={[styles.radio, !selectedCardId && styles.radioSelected]} />
                      <Text style={styles.cardRowText}>카드 지정 안함</Text>
                    </TouchableOpacity>

                    {filteredCards.map((card) => (
                      <TouchableOpacity
                        key={card.id}
                        style={styles.cardRow}
                        onPress={() => setSelectedCardId(card.id)}
                      >
                        <View style={[styles.radio, selectedCardId === card.id && styles.radioSelected]} />
                        <Text style={styles.cardRowText}>{card.name}</Text>
                      </TouchableOpacity>
                    ))}

                    {showAddCard ? (
                      <View style={styles.addCardRow}>
                        <TextInput
                          style={[styles.input, styles.addCardInput]}
                          value={newCardName}
                          onChangeText={setNewCardName}
                          placeholder="카드 이름 입력"
                          placeholderTextColor={theme.colors.text.hint}
                          autoFocus
                        />
                        <TouchableOpacity style={styles.addCardBtn} onPress={handleAddCard}>
                          <Text style={styles.addCardBtnText}>추가</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setShowAddCard(true)}>
                        <Text style={styles.addCardLink}>+ 새 카드 추가...</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}

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

// ── FavoritesSection ──────────────────────────────────────

interface FavoritesSectionProps {
  favorites: Transaction[];
  expanded: boolean;
  onToggle: () => void;
  onPress: (fav: Transaction) => void;
}

function FavoritesSection({ favorites, expanded, onToggle, onPress }: FavoritesSectionProps) {
  const { categories } = useCategoryStore();
  if (favorites.length === 0) return null;
  return (
    <View style={styles.favSection}>
      <TouchableOpacity
        style={styles.favSectionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.favSectionTitle}>
          <Text style={styles.favSectionTitleText}>★ 자주 쓰는 거래</Text>
          <View style={styles.favBadge}>
            <Text style={styles.favBadgeText}>{favorites.length}</Text>
          </View>
        </View>
        <Text style={styles.favToggleText}>{expanded ? "∧" : "∨"}</Text>
      </TouchableOpacity>
      {expanded && favorites.map((fav) => {
        const category = categories.find((c) => c.id === fav.category_id);
        const typeColor = TYPE_COLORS[fav.type] ?? theme.colors.transfer;
        return (
          <TouchableOpacity
            key={fav.id}
            style={styles.favItem}
            onPress={() => onPress(fav)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeDot, { backgroundColor: category?.color ?? typeColor }]} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowDescription} numberOfLines={1}>
                {fav.description ?? TYPE_LABELS[fav.type] ?? fav.type}
              </Text>
              {category && (
                <Text style={styles.rowCategory}>{category.name}</Text>
              )}
            </View>
            <Text style={[styles.rowAmount, { color: typeColor }]}>
              {formatAmount(fav.type, fav.amount)}
            </Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.favSectionDivider} />
    </View>
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
    toggleFavorite,
  } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { cards, fetchCards } = useCardStore();
  const { isOnline } = useNetworkStatus();

  // Step 4: modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const favorites = useMemo(
    () => transactions.filter((t) => t.is_favorite && t.type !== "transfer").slice(0, 10),
    [transactions]
  );
  const [contextTx, setContextTx] = useState<Transaction | null>(null);
  const [favoritePrefill, setFavoritePrefill] = useState<Transaction | null>(null);
  const [favExpanded, setFavExpanded] = useState(true);

  // Step 2: calendar state
  const today = useMemo(() => todayKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(today);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
    fetchCards();
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
    setFavoritePrefill(null);
    setModalVisible(true);
  };

  const openFromFavorite = (fav: Transaction) => {
    setEditing(null);
    setFavoritePrefill(fav);
    setModalVisible(true);
  };

  const handleToggleFavorite = async () => {
    if (!contextTx) return;
    try {
      await toggleFavorite(contextTx.id, !contextTx.is_favorite);
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "즐겨찾기 변경에 실패했습니다.");
    } finally {
      setContextTx(null);
    }
  };

  // Step 3: delete handler
  const handleDelete = (item: Transaction) => {
    const msg = item.is_favorite
      ? "즐겨찾기에 등록된 항목입니다. 삭제하면 즐겨찾기에서도 제거됩니다."
      : "이 내역을 삭제할까요?";
    const doDelete = () => deleteTransaction(item.id, isOnline);
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert("삭제", msg, [
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
    datetime: string,
    paymentType: string | null,
    userCardId: string | null
  ) => {
    const payload = {
      type,
      amount: Number(amount),
      description: description || undefined,
      category_id: categoryId || undefined,
      transacted_at: localDateTimeToISO(datetime),
      payment_type: paymentType as "cash" | "credit_card" | "debit_card" | "bank" | undefined ?? undefined,
      user_card_id: userCardId || undefined,
    };
    if (editing) {
      await updateTransaction(editing.id, payload, isOnline);
    } else {
      await createTransaction(payload, isOnline);
    }
  };

  const getCategoryName = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId)?.name ?? null;

  const getCardName = (cardId: string | null) =>
    cards.find((c) => c.id === cardId)?.name ?? null;

  const getPaymentLabel = (tx: Transaction): string | null => {
    if (!tx.payment_type) return null;
    if ((tx.payment_type === "credit_card" || tx.payment_type === "debit_card") && tx.user_card_id) {
      return getCardName(tx.user_card_id) ?? PAYMENT_LABELS[tx.payment_type];
    }
    return PAYMENT_LABELS[tx.payment_type] ?? null;
  };

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
          ListHeaderComponent={
            <FavoritesSection
              favorites={favorites}
              expanded={favExpanded}
              onToggle={() => setFavExpanded((prev) => !prev)}
              onPress={openFromFavorite}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const typeColor = TYPE_COLORS[item.type] ?? theme.colors.transfer;
            const paymentLabel = getPaymentLabel(item);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => openEdit(item)}
                onLongPress={() => setContextTx(item)}
                delayLongPress={400}
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
                  {paymentLabel && (
                    <Text style={styles.rowPayment}>{paymentLabel}</Text>
                  )}
                </View>
                <Text style={[styles.rowAmount, { color: typeColor }]}>
                  {formatAmount(item.type, item.amount)}
                </Text>
                {item._isPending && (
                  <Text style={{ fontSize: 10, color: '#FF9500', marginRight: 4 }}>↻</Text>
                )}
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
        prefill={editing ? null : favoritePrefill}
        initialDate={editing ? undefined : (selectedDay ?? today)}
        onClose={() => {
          setModalVisible(false);
          setFavoritePrefill(null);
        }}
        onSubmit={handleSubmit}
      />

      {/* Long-press context menu */}
      <Modal
        visible={!!contextTx}
        transparent
        animationType="fade"
        onRequestClose={() => setContextTx(null)}
      >
        <TouchableOpacity
          style={styles.contextOverlay}
          activeOpacity={1}
          onPress={() => setContextTx(null)}
        >
          <View style={styles.contextMenu}>
            <Text style={styles.contextTitle} numberOfLines={1}>
              {contextTx?.description ?? TYPE_LABELS[contextTx?.type ?? "expense"] ?? "거래"}
            </Text>
            <TouchableOpacity style={styles.contextOption} onPress={handleToggleFavorite}>
              <Text style={styles.contextOptionText}>
                {contextTx?.is_favorite ? "⭐ 즐겨찾기 해제" : "☆ 즐겨찾기 추가"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextCancel}
              onPress={() => setContextTx(null)}
            >
              <Text style={styles.contextCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  rowPayment: {
    ...theme.typography.caption,
    color: theme.colors.text.hint,
    marginTop: 1,
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
    height: "90%",
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
  categoryHint: {
    fontSize: 12,
    color: theme.colors.text.hint,
    fontStyle: "italic",
    marginBottom: 4,
  },
  suggestBadge: {
    marginLeft: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  suggestBadgeText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  suggestHintText: { fontSize: 12, marginLeft: 2 },

  // Payment method
  paymentRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  paymentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  paymentBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  paymentBtnText: { fontSize: 12, color: theme.colors.text.secondary },
  paymentBtnTextActive: { color: "#fff", fontWeight: "600" },

  // Card section
  cardSection: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginRight: 10,
  },
  radioSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  cardRowText: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  addCardLink: {
    fontSize: 13,
    color: theme.colors.primary,
    paddingVertical: 10,
  },
  addCardRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 6,
  },
  addCardInput: { flex: 1, marginBottom: 0 },
  addCardBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
  },
  addCardBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

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

  // Favorites section
  favSection: {
    backgroundColor: theme.colors.bg,
    marginBottom: theme.spacing.sm,
  },
  favSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  favSectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favSectionTitleText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  favBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  favBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  favToggleText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  favItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  favSectionDivider: {
    height: 8,
    backgroundColor: theme.colors.surface,
  },

  // Context menu
  contextOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  contextMenu: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    width: 280,
    overflow: "hidden",
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contextOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contextOptionText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    textAlign: "center",
  },
  contextCancel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contextCancelText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
});
