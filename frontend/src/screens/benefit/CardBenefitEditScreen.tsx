// frontend/src/screens/benefit/CardBenefitEditScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCardStore } from "../../store/cardStore";
import { useCardBenefitStore } from "../../store/cardBenefitStore";
import { UserCard, UserCardBenefit } from "../../types";
import { theme } from "../../theme";
import { formatWithCommas, stripCommas } from "../../utils/formatCurrency";

const CATEGORIES = ["전체", "식비", "교통", "쇼핑", "의료", "여행", "통신", "주유", "문화/여가"];
const BENEFIT_TYPES = [
  { value: "cashback", label: "캐시백" },
  { value: "points", label: "포인트" },
  { value: "discount", label: "할인" },
  { value: "free", label: "무료" },
] as const;

type BenefitType = "cashback" | "points" | "discount" | "free";

// ── 혜택 추가/수정 모달 ────────────────────────────────────

interface BenefitFields {
  category: string;
  benefit_type: BenefitType;
  rate: string;
  flat_amount: string;
  monthly_cap: string;
  min_amount: string;
}

const DEFAULT_FIELDS: BenefitFields = {
  category: "전체",
  benefit_type: "cashback",
  rate: "",
  flat_amount: "",
  monthly_cap: "",
  min_amount: "",
};

interface BenefitModalProps {
  visible: boolean;
  editing: UserCardBenefit | null;
  onClose: () => void;
  onSubmit: (fields: BenefitFields) => Promise<void>;
}

function BenefitModal({ visible, editing, onClose, onSubmit }: BenefitModalProps) {
  const [fields, setFields] = useState<BenefitFields>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editing) {
        setFields({
          category: editing.category,
          benefit_type: editing.benefit_type as BenefitType,
          rate: editing.rate !== null ? String(editing.rate) : "",
          flat_amount: editing.flat_amount !== null ? String(editing.flat_amount) : "",
          monthly_cap: editing.monthly_cap !== null ? String(editing.monthly_cap) : "",
          min_amount: editing.min_amount !== null ? String(editing.min_amount) : "",
        });
      } else {
        setFields(DEFAULT_FIELDS);
      }
    }
  }, [visible, editing]);

  const needsRate = fields.benefit_type === "cashback" || fields.benefit_type === "points";

  const handleSubmit = async () => {
    if (needsRate && !fields.rate.trim()) {
      Alert.alert("오류", "적립률(%)을 입력해주세요.");
      return;
    }
    if (!needsRate && !fields.flat_amount.trim()) {
      Alert.alert("오류", "고정 혜택 금액을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(fields);
      onClose();
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{editing ? "혜택 수정" : "혜택 추가"}</Text>

            {/* 카테고리 */}
            <Text style={styles.label}>카테고리</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, fields.category === cat && styles.chipActive]}
                    onPress={() => setFields((f) => ({ ...f, category: cat }))}
                    accessibilityLabel={`카테고리: ${cat}`}
                  >
                    <Text style={[styles.chipText, fields.category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* 혜택 유형 */}
            <Text style={styles.label}>혜택 유형</Text>
            <View style={styles.typeRow}>
              {BENEFIT_TYPES.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.typeBtn, fields.benefit_type === value && styles.typeBtnActive]}
                  onPress={() => setFields((f) => ({ ...f, benefit_type: value }))}
                  accessibilityLabel={`혜택 유형: ${label}`}
                >
                  <Text style={[styles.typeBtnText, fields.benefit_type === value && styles.typeBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 적립률 or 고정금액 */}
            {needsRate ? (
              <>
                <Text style={styles.label}>적립률 (%)</Text>
                <TextInput
                  style={styles.input}
                  value={fields.rate}
                  onChangeText={(v) => setFields((f) => ({ ...f, rate: v.replace(/[^0-9.]/g, "") }))}
                  keyboardType="decimal-pad"
                  placeholder="예: 3 (3%)"
                  placeholderTextColor={theme.colors.text.hint}
                  accessibilityLabel="적립률 입력"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>고정 혜택 금액 (원)</Text>
                <TextInput
                  style={styles.input}
                  value={formatWithCommas(fields.flat_amount)}
                  onChangeText={(v) => setFields((f) => ({ ...f, flat_amount: stripCommas(v) }))}
                  keyboardType="numeric"
                  placeholder="예: 2,000"
                  placeholderTextColor={theme.colors.text.hint}
                  accessibilityLabel="고정 혜택 금액 입력"
                />
              </>
            )}

            {/* 월 한도 */}
            <Text style={styles.label}>월 최대 혜택 한도 (원, 선택)</Text>
            <TextInput
              style={styles.input}
              value={formatWithCommas(fields.monthly_cap)}
              onChangeText={(v) => setFields((f) => ({ ...f, monthly_cap: stripCommas(v) }))}
              keyboardType="numeric"
              placeholder="예: 10,000  (비워두면 무제한)"
              placeholderTextColor={theme.colors.text.hint}
              accessibilityLabel="월 최대 혜택 한도 입력"
            />

            {/* 최소 결제금액 */}
            <Text style={styles.label}>최소 결제 금액 (원, 선택)</Text>
            <TextInput
              style={styles.input}
              value={formatWithCommas(fields.min_amount)}
              onChangeText={(v) => setFields((f) => ({ ...f, min_amount: stripCommas(v) }))}
              keyboardType="numeric"
              placeholder="예: 5,000  (비워두면 조건 없음)"
              placeholderTextColor={theme.colors.text.hint}
              accessibilityLabel="최소 결제 금액 입력"
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityLabel="취소">
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
                accessibilityLabel="저장"
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>저장</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── 혜택 아이템 ────────────────────────────────────────────

interface BenefitRowProps {
  benefit: UserCardBenefit;
  onEdit: () => void;
  onDelete: () => void;
}

function BenefitRow({ benefit, onEdit, onDelete }: BenefitRowProps) {
  const typeLabel: Record<string, string> = {
    cashback: "캐시백",
    points: "포인트",
    discount: "할인",
    free: "무료",
  };
  const valueText =
    benefit.benefit_type === "cashback" || benefit.benefit_type === "points"
      ? `${benefit.rate}%`
      : `${(benefit.flat_amount ?? 0).toLocaleString("ko-KR")}원`;

  const capText = benefit.monthly_cap ? ` · 월 최대 ${benefit.monthly_cap.toLocaleString("ko-KR")}원` : "";

  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitInfo}>
        <View style={styles.benefitChip}>
          <Text style={styles.benefitChipText}>{benefit.category}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.benefitValueText}>
            {typeLabel[benefit.benefit_type]} {valueText}
            {capText}
          </Text>
          {benefit.min_amount ? (
            <Text style={styles.benefitSubText}>
              {benefit.min_amount.toLocaleString("ko-KR")}원 이상 결제 시
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.benefitActions}>
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="혜택 수정">
          <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={{ marginLeft: 12 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="혜택 삭제"
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.expense} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 메인 화면 ──────────────────────────────────────────────

export default function CardBenefitEditScreen() {
  const { cards, fetchCards, isLoading: cardsLoading } = useCardStore();
  const { benefits, isLoading: benefitsLoading, fetchBenefits, createBenefit, updateBenefit, deleteBenefit } =
    useCardBenefitStore();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<UserCardBenefit | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCards();
      if (selectedCardId) {
        await fetchBenefits(selectedCardId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchCards, fetchBenefits, selectedCardId]);

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    if (cards.length > 0 && selectedCardId === null) {
      const firstId = cards[0].id;
      setSelectedCardId(firstId);
      fetchBenefits(firstId);
    }
  }, [cards]);

  const handleSelectCard = (card: UserCard) => {
    setSelectedCardId(card.id);
    fetchBenefits(card.id);
  };

  const handleOpenAdd = () => {
    setEditingBenefit(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (benefit: UserCardBenefit) => {
    setEditingBenefit(benefit);
    setModalVisible(true);
  };

  const handleDelete = (benefit: UserCardBenefit) => {
    if (!selectedCardId) return;
    const doDelete = () => deleteBenefit(selectedCardId, benefit.id).catch(() => {
      Alert.alert("오류", "삭제에 실패했습니다.");
    });
    if (Platform.OS === "web") {
      if (window.confirm(`이 혜택을 삭제할까요?`)) doDelete();
    } else {
      Alert.alert("혜택 삭제", "이 혜택을 삭제할까요?", [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleSubmit = async (fields: BenefitFields) => {
    if (!selectedCardId) return;
    const payload = {
      category: fields.category,
      benefit_type: fields.benefit_type,
      rate: fields.rate.trim() ? parseFloat(fields.rate) : null,
      flat_amount: fields.flat_amount.trim() ? parseInt(fields.flat_amount, 10) : null,
      monthly_cap: fields.monthly_cap.trim() ? parseInt(fields.monthly_cap, 10) : null,
      min_amount: fields.min_amount.trim() ? parseInt(fields.min_amount, 10) : null,
    };
    if (editingBenefit) {
      await updateBenefit(selectedCardId, editingBenefit.id, payload);
    } else {
      await createBenefit(selectedCardId, payload);
    }
  };

  const currentBenefits = selectedCardId ? (benefits[selectedCardId] ?? []) : [];

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>카드 혜택 관리</Text>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : cards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💳</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8, textAlign: 'center' }}>등록된 카드 없음</Text>
          <Text style={{ fontSize: 14, color: theme.colors.text.hint, textAlign: 'center', lineHeight: 20 }}>설정에서 카드를 먼저 추가해주세요.</Text>
        </View>
      ) : (
        <>
          {/* 카드 선택 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cardSelectorScroll}
            contentContainerStyle={styles.cardSelectorContent}
          >
            {cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[styles.cardChip, selectedCardId === card.id && styles.cardChipActive]}
                onPress={() => handleSelectCard(card)}
                accessibilityLabel={`카드 선택: ${card.name}`}
              >
                <Ionicons
                  name="card-outline"
                  size={14}
                  color={selectedCardId === card.id ? "#fff" : theme.colors.text.secondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.cardChipText,
                    selectedCardId === card.id && styles.cardChipTextActive,
                  ]}
                >
                  {card.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 혜택 목록 */}
          {benefitsLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
          ) : (
            <FlatList
              data={currentBenefits}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.benefitListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
              renderItem={({ item }) => (
                <BenefitRow
                  benefit={item}
                  onEdit={() => handleOpenEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              )}
              ListEmptyComponent={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8, textAlign: 'center' }}>등록된 혜택 없음</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.text.hint, textAlign: 'center', lineHeight: 20 }}>아래 + 버튼으로 혜택을 추가해보세요.</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* FAB */}
      {cards.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleOpenAdd} activeOpacity={0.7} accessibilityLabel="혜택 추가">
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <BenefitModal
        visible={modalVisible}
        editing={editingBenefit}
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
  headerTitle: { ...theme.typography.h2, color: theme.colors.text.primary },
  // emptyContainer/emptyText styles removed — unified empty state pattern uses inline styles
  cardSelectorScroll: { flexGrow: 0, backgroundColor: theme.colors.bg },
  cardSelectorContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  cardChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  cardChipText: { fontSize: 13, color: theme.colors.text.secondary, fontWeight: "500" },
  cardChipTextActive: { color: "#fff" },
  benefitListContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  benefitInfo: { flex: 1, flexDirection: "row", alignItems: "flex-start" },
  benefitChip: {
    backgroundColor: `${theme.colors.primary}15`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  benefitChipText: { fontSize: 12, color: theme.colors.primary, fontWeight: "600" },
  benefitValueText: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  benefitSubText: { fontSize: 12, color: theme.colors.text.hint, marginTop: 2 },
  benefitActions: { flexDirection: "row", alignItems: "center" },
  // emptyBenefits/emptyBenefitsText styles removed — unified empty state pattern uses inline styles
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
  // modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "80%",
  },
  sheetTitle: { ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 16 },
  label: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
    fontWeight: "600",
  },
  chipRow: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, color: theme.colors.text.secondary },
  chipTextActive: { color: "#fff" },
  typeRow: { flexDirection: "row", gap: 6 },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  typeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeBtnText: { fontSize: 13, color: theme.colors.text.secondary },
  typeBtnTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
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
