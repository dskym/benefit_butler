// frontend/src/screens/settings/CardListScreen.tsx
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
import { Ionicons } from "@expo/vector-icons";
import { useCardStore } from "../../store/cardStore";
import { UserCard } from "../../types";
import { theme } from "../../theme";

type CardType = "credit_card" | "debit_card";

const TYPE_LABELS: Record<CardType, string> = {
  credit_card: "신용카드",
  debit_card: "체크카드",
};

const TYPE_ORDER: CardType[] = ["credit_card", "debit_card"];

// ── 추가 모달 ──────────────────────────────────────────────
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: CardType) => Promise<void>;
}

function AddModal({ visible, onClose, onSubmit }: AddModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CardType>("credit_card");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setType("credit_card");
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("오류", "카드 이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(name.trim(), type);
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>카드 추가</Text>

            <Text style={styles.label}>카드 이름</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 신한 SOL 체크카드"
              placeholderTextColor={theme.colors.text.hint}
              autoFocus
            />

            <Text style={styles.label}>종류</Text>
            <View style={styles.typeRow}>
              {TYPE_ORDER.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    type === t && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeBtnText, type === t && { color: "#fff" }]}>
                    {TYPE_LABELS[t]}
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
export default function CardListScreen() {
  const { cards, isLoading, fetchCards, createCard, deleteCard } = useCardStore();
  const [modalVisible, setModalVisible] = useState(false);

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

  const handleSubmit = async (name: string, type: CardType) => {
    await createCard({ type, name });
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
              <Text style={styles.sectionLabel}>{section.label}</Text>
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
                      <Text style={styles.rowName}>{card.name}</Text>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDelete(card)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            <Text style={styles.empty}>
              등록된 카드가 없습니다.{"\n"}아래 + 버튼으로 추가해보세요.
            </Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddModal
        visible={modalVisible}
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
  sectionBlock: { marginBottom: theme.spacing.sm },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
  sectionCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
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
  rowName: { flex: 1, fontSize: 16, color: theme.colors.text.primary },
  iconBtn: { padding: 6 },
  empty: {
    textAlign: "center",
    color: theme.colors.text.hint,
    marginTop: 60,
    fontSize: 15,
    lineHeight: 24,
  },
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: "60%",
  },
  sheetTitle: { ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: 20 },
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
