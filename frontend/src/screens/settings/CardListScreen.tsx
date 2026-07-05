// frontend/src/screens/settings/CardListScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCardStore } from "../../store/cardStore";
import { CardCatalog, UserCard } from "../../types";
import { theme } from "../../theme";
import {
  Button,
  TextInputField,
  BottomSheet,
  FAB,
  EmptyState,
  SectionHeader,
} from "../../components/ui";
import { formatWithCommas, stripCommas } from "../../utils/formatCurrency";

type CardType = "credit_card" | "debit_card";

const TYPE_LABELS: Record<CardType, string> = {
  credit_card: "신용카드",
  debit_card: "체크카드",
};

const TYPE_ORDER: CardType[] = ["credit_card", "debit_card"];

// ── 공통 폼 필드 ──────────────────────────────────────────────

interface CardFormFields {
  name: string;
  type: CardType;
  monthly_target: string;
  billing_day: string;
  catalog_id: string | null;
}

// ── 추가 모달 ──────────────────────────────────────────────

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (fields: CardFormFields) => Promise<void>;
}

function AddModal({ visible, onClose, onSubmit }: AddModalProps) {
  const { catalogResults, isSearchingCatalog, searchCatalog, clearCatalogResults } = useCardStore();
  const [fields, setFields] = useState<CardFormFields>({
    name: "",
    type: "credit_card",
    monthly_target: "",
    billing_day: "",
    catalog_id: null,
  });
  const [selectedCatalog, setSelectedCatalog] = useState<CardCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setFields({ name: "", type: "credit_card", monthly_target: "", billing_day: "", catalog_id: null });
      setSelectedCatalog(null);
      clearCatalogResults();
    }
  }, [visible, clearCatalogResults]);

  // 카드 이름 입력 → 디바운스 카탈로그 검색 (카탈로그 미선택 상태에서만)
  const handleNameChange = (v: string) => {
    setFields((f) => ({ ...f, name: v, catalog_id: null }));
    setSelectedCatalog(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCatalog(v), 400);
  };

  const handleSelectCatalog = (catalog: CardCatalog) => {
    setSelectedCatalog(catalog);
    setFields((f) => ({
      ...f,
      name: catalog.name,
      type: catalog.card_type,
      catalog_id: catalog.id,
    }));
    clearCatalogResults();
  };

  const handleSubmit = async () => {
    if (!fields.name.trim()) {
      Alert.alert("오류", "카드 이름을 입력해주세요.");
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
    <BottomSheet visible={visible} onClose={onClose} title="카드 추가">
      <TextInputField
        label="카드 이름"
        value={fields.name}
        onChangeText={handleNameChange}
        placeholder="예: 신한 SOL 체크카드 (검색하면 카탈로그에서 찾아드려요)"
        autoFocus
        accessibilityLabel="카드 이름 입력"
      />

      {/* 카탈로그 검색 결과 */}
      {isSearchingCatalog && <ActivityIndicator size="small" color={theme.colors.primary} />}
      {catalogResults.length > 0 && !selectedCatalog && (
        <View style={styles.catalogResults}>
          {catalogResults.slice(0, 5).map((catalog) => (
            <TouchableOpacity
              key={catalog.id}
              style={styles.catalogItem}
              onPress={() => handleSelectCatalog(catalog)}
              accessibilityLabel={`카탈로그 카드 선택: ${catalog.name}`}
            >
              <Ionicons name="card" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.catalogName}>{catalog.name}</Text>
                <Text style={styles.catalogSub}>
                  {catalog.issuer} · {TYPE_LABELS[catalog.card_type]} · 혜택 {catalog.benefits.length}개
                </Text>
              </View>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 선택된 카탈로그 안내 */}
      {selectedCatalog && (
        <View style={styles.catalogSelected}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.income} />
          <Text style={styles.catalogSelectedText}>
            {selectedCatalog.issuer} {selectedCatalog.name} — 혜택 {selectedCatalog.benefits.length}개 자동 연결
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSelectedCatalog(null);
              setFields((f) => ({ ...f, catalog_id: null }));
            }}
            accessibilityLabel="카탈로그 연결 해제"
          >
            <Ionicons name="close-circle" size={16} color={theme.colors.text.hint} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>종류</Text>
      <View style={styles.typeRow}>
        {TYPE_ORDER.map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.typeBtn,
              fields.type === t && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setFields((f) => ({ ...f, type: t }))}
            accessibilityLabel={`종류: ${TYPE_LABELS[t]}`}
          >
            <Text style={[styles.typeBtnText, fields.type === t && { color: "#fff" }]}>
              {TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInputField
        label="월 실적 목표 (원, 선택)"
        value={formatWithCommas(fields.monthly_target)}
        onChangeText={(v) => setFields((f) => ({ ...f, monthly_target: stripCommas(v) }))}
        keyboardType="numeric"
        placeholder="예: 300,000"
        accessibilityLabel="월 실적 목표 입력"
      />

      <TextInputField
        label="결제일 (1~28, 선택)"
        value={fields.billing_day}
        onChangeText={(v) => setFields((f) => ({ ...f, billing_day: v.replace(/[^0-9]/g, "") }))}
        keyboardType="numeric"
        placeholder="예: 14  (비워두면 달력 월 기준)"
        hint="결제일 14일이 실적 관리에 가장 편리합니다."
        accessibilityLabel="결제일 입력"
      />

      <View style={styles.sheetActions}>
        <Button label="취소" variant="secondary" onPress={onClose} flex={1} />
        <Button label="저장" onPress={handleSubmit} loading={loading} flex={2} />
      </View>
    </BottomSheet>
  );
}

// ── 편집 모달 ──────────────────────────────────────────────

interface EditModalProps {
  card: UserCard | null;
  onClose: () => void;
  onSubmit: (card: UserCard, fields: Pick<CardFormFields, "monthly_target" | "billing_day">) => Promise<void>;
}

function EditModal({ card, onClose, onSubmit }: EditModalProps) {
  const [fields, setFields] = useState({ monthly_target: "", billing_day: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (card) {
      setFields({
        monthly_target: card.monthly_target !== null ? String(card.monthly_target) : "",
        billing_day: card.billing_day !== null ? String(card.billing_day) : "",
      });
    }
  }, [card]);

  if (!card) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(card, fields);
      onClose();
    } catch (e: any) {
      Alert.alert("오류", e.response?.data?.detail ?? "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={!!card} onClose={onClose} title={`${card.name} 설정`}>
      <TextInputField
        label="월 실적 목표 (원, 선택)"
        value={formatWithCommas(fields.monthly_target)}
        onChangeText={(v) => setFields((f) => ({ ...f, monthly_target: stripCommas(v) }))}
        keyboardType="numeric"
        placeholder="예: 300,000"
        autoFocus
        accessibilityLabel="월 실적 목표 입력"
      />

      <TextInputField
        label="결제일 (1~28, 선택)"
        value={fields.billing_day}
        onChangeText={(v) => setFields((f) => ({ ...f, billing_day: v.replace(/[^0-9]/g, "") }))}
        keyboardType="numeric"
        placeholder="예: 14  (비워두면 달력 월 기준)"
        hint="결제일 14일이 실적 관리에 가장 편리합니다."
        accessibilityLabel="결제일 입력"
      />

      <View style={styles.sheetActions}>
        <Button label="취소" variant="secondary" onPress={onClose} flex={1} />
        <Button label="저장" onPress={handleSubmit} loading={loading} flex={2} />
      </View>
    </BottomSheet>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────

export default function CardListScreen() {
  const { cards, isLoading, fetchCards, createCard, updateCard, deleteCard } = useCardStore();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<UserCard | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const handleDelete = (item: UserCard) => {
    const doDelete = () => deleteCard(item.id);
    if (Platform.OS === "web") {
      if (
        window.confirm(
          `"${item.name}" 카드를 삭제할까요?\n이 카드로 기록된 거래의 카드 정보가 삭제됩니다.`
        )
      )
        doDelete();
    } else {
      Alert.alert(
        "카드 삭제",
        `"${item.name}" 카드를 삭제할까요?\n이 카드로 기록된 거래의 카드 정보가 삭제됩니다.`,
        [
          { text: "취소", style: "cancel" },
          { text: "삭제", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handleAddSubmit = async (fields: CardFormFields) => {
    const targetRaw = fields.monthly_target.trim();
    const billingRaw = fields.billing_day.trim();
    await createCard({
      type: fields.type,
      name: fields.name.trim(),
      monthly_target: targetRaw ? parseInt(targetRaw, 10) : null,
      billing_day: billingRaw ? Math.min(28, Math.max(1, parseInt(billingRaw, 10))) : null,
      catalog_id: fields.catalog_id,
    });
  };

  const handleEditSubmit = async (
    card: UserCard,
    fields: Pick<CardFormFields, "monthly_target" | "billing_day">
  ) => {
    const targetRaw = fields.monthly_target.trim();
    const billingRaw = fields.billing_day.trim();
    await updateCard(card.id, {
      monthly_target: targetRaw ? parseInt(targetRaw, 10) : null,
      billing_day: billingRaw ? Math.min(28, Math.max(1, parseInt(billingRaw, 10))) : null,
    });
  };

  const sections = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    data: cards.filter((c) => c.type === type),
  })).filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.type}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: section }) => (
            <View style={styles.sectionBlock}>
              <SectionHeader title={section.label} />
              <View style={styles.sectionCard}>
                {section.data.map((card, index) => (
                  <View key={card.id}>
                    <View
                      style={[
                        styles.row,
                        index === 0 && styles.rowFirst,
                        index === section.data.length - 1 && styles.rowLast,
                      ]}
                    >
                      <Ionicons
                        name="card-outline"
                        size={20}
                        color={theme.colors.primary}
                        style={styles.cardIcon}
                      />
                      <View style={styles.rowMain}>
                        <Text style={styles.rowName}>{card.name}</Text>
                        {(card.monthly_target !== null || card.billing_day !== null) && (
                          <Text style={styles.rowSub}>
                            {card.monthly_target !== null
                              ? `목표 ${card.monthly_target.toLocaleString("ko-KR")}원`
                              : "목표 미설정"}
                            {card.billing_day !== null ? `  ·  결제일 ${card.billing_day}일` : ""}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => setEditingCard(card)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`${card.name} 수정`}
                      >
                        <Ionicons name="pencil-outline" size={18} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDelete(card)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`${card.name} 삭제`}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.colors.expense} />
                      </TouchableOpacity>
                    </View>
                    {index < section.data.length - 1 && <View style={styles.separator} />}
                  </View>
                ))}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="💳"
              title="등록된 카드 없음"
              subtitle="아래 + 버튼으로 카드를 추가해보세요."
            />
          }
        />
      )}

      <FAB onPress={() => setAddModalVisible(true)} accessibilityLabel="카드 추가" />

      <AddModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSubmit={handleAddSubmit}
      />

      <EditModal
        card={editingCard}
        onClose={() => setEditingCard(null)}
        onSubmit={handleEditSubmit}
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
  sectionBlock: { marginBottom: theme.spacing.sm },
  sectionCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    ...theme.shadow.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.bg,
  },
  rowFirst: { borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  rowLast: { borderBottomLeftRadius: theme.radius.lg, borderBottomRightRadius: theme.radius.lg },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  cardIcon: { marginRight: theme.spacing.sm },
  rowMain: { flex: 1 },
  rowName: { fontSize: 16, color: theme.colors.text.primary },
  rowSub: { fontSize: 12, color: theme.colors.text.hint, marginTop: 2 },
  iconBtn: { padding: 6 },
  label: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
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
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 24, marginBottom: 8 },
  catalogResults: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    marginTop: 4,
    overflow: "hidden",
  },
  catalogItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  catalogName: { fontSize: 14, color: theme.colors.text.primary, fontWeight: "500" },
  catalogSub: { fontSize: 11, color: theme.colors.text.hint, marginTop: 1 },
  catalogSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: "#E8F5E9",
  },
  catalogSelectedText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#2E7D32" },
});
