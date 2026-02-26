// frontend/src/screens/benefit/CardRecommendScreen.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRecommendStore } from "../../store/recommendStore";
import { RecommendResult } from "../../types";
import { theme } from "../../theme";

const CATEGORIES = ["전체", "식비", "교통", "쇼핑", "의료", "여행", "통신", "주유", "문화/여가"];

// ── 추천 결과 카드 ──────────────────────────────────────────

function ResultCard({ item }: { item: RecommendResult }) {
  const benefitTypeLabel: Record<string, string> = {
    cashback: "캐시백",
    points: "포인트",
    discount: "할인",
    free: "무료",
  };

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultLeft}>
          <Ionicons name="card" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.cardName}>{item.card_name}</Text>
            <Text style={styles.benefitDesc}>{item.benefit_description}</Text>
          </View>
        </View>
        <View style={styles.resultRight}>
          {item.is_near_target && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>실적 임박</Text>
            </View>
          )}
          <Text style={styles.effectiveValue}>
            {item.effective_value > 0
              ? `+${item.effective_value.toLocaleString("ko-KR")}원`
              : "-"}
          </Text>
          <Text style={styles.benefitTypeLabel}>{benefitTypeLabel[item.benefit_type] ?? item.benefit_type}</Text>
        </View>
      </View>
    </View>
  );
}

// ── 메인 화면 ──────────────────────────────────────────────

export default function CardRecommendScreen() {
  const navigation = useNavigation<any>();
  const { results, isLoading, recommend, clear } = useRecommendStore();

  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("10000");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const name = merchantName.trim();
    if (!name) return;
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10) || 10000;
    const cat = selectedCategory === "전체" ? null : selectedCategory;
    setHasSearched(true);
    await recommend(name, amt, cat);
  };

  const handleClear = () => {
    setMerchantName("");
    setAmount("10000");
    setSelectedCategory(null);
    setHasSearched(false);
    clear();
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>카드 추천</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate("CardBenefitEdit")}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={hasSearched ? results : []}
        keyExtractor={(item) => item.card_id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* 검색 입력 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>가맹점명</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  value={merchantName}
                  onChangeText={setMerchantName}
                  placeholder="예: 스타벅스, 이마트, 주유소"
                  placeholderTextColor={theme.colors.text.hint}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {merchantName.length > 0 && (
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.text.hint} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 카테고리 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>업종 선택</Text>
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      (selectedCategory === cat || (cat === "전체" && selectedCategory === null)) &&
                        styles.catChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat === "전체" ? null : cat)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        (selectedCategory === cat || (cat === "전체" && selectedCategory === null)) &&
                          styles.catChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 금액 입력 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>결제 금액 (원)</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder="10000"
                placeholderTextColor={theme.colors.text.hint}
              />
            </View>

            {/* 검색 버튼 */}
            <TouchableOpacity
              style={[styles.searchBtn, (!merchantName.trim() || isLoading) && { opacity: 0.5 }]}
              onPress={handleSearch}
              disabled={!merchantName.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.searchBtnText}>추천 카드 찾기</Text>
              )}
            </TouchableOpacity>

            {/* 결과 헤더 */}
            {hasSearched && !isLoading && (
              <View style={styles.resultsTitleRow}>
                <Text style={styles.resultsTitle}>
                  {results.length > 0
                    ? `추천 카드 ${results.length}개`
                    : "추천 카드 없음"}
                </Text>
                {results.length === 0 && (
                  <Text style={styles.resultsEmpty}>
                    이 가맹점에 혜택이 있는 카드가 없습니다.{"\n"}카드 혜택을 설정해 주세요.
                  </Text>
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <ResultCard item={item} />}
        ListEmptyComponent={null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: { ...theme.typography.h2, color: theme.colors.text.primary },
  editBtn: { padding: 4 },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 40,
  },
  section: { marginTop: theme.spacing.md },
  sectionLabel: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  clearBtn: { padding: 4 },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  catChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catChipText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: "500",
  },
  catChipTextActive: { color: "#fff" },
  amountInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  searchBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resultsTitleRow: { marginTop: theme.spacing.lg },
  resultsTitle: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  resultsEmpty: {
    fontSize: 14,
    color: theme.colors.text.hint,
    lineHeight: 22,
    marginTop: 4,
  },
  // result card
  resultCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  resultLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    maxWidth: 180,
  },
  resultRight: { alignItems: "flex-end", marginLeft: 8 },
  badge: {
    backgroundColor: "#FFF3CD",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#856404" },
  effectiveValue: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.income,
  },
  benefitTypeLabel: {
    fontSize: 11,
    color: theme.colors.text.hint,
    marginTop: 2,
  },
});
