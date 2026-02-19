// frontend/src/screens/home/HomeScreen.tsx
import React, { useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart, BarChart } from "react-native-gifted-charts";
import { useNavigation } from "@react-navigation/native";
import { useTransactionStore } from "../../store/transactionStore";
import { useCategoryStore } from "../../store/categoryStore";
import { useAuthStore } from "../../store/authStore";
import { theme } from "../../theme";
import { Transaction } from "../../types";

type TxType = "income" | "expense" | "transfer";

const CHART_COLORS = [
  "#3182F6", "#22C55E", "#F04452", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

function formatAmount(type: TxType, amount: number): string {
  const n = amount.toLocaleString("ko-KR");
  if (type === "income") return `+${n}원`;
  if (type === "expense") return `-${n}원`;
  return `${n}원`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function subMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d;
}

function monthLabel(date: Date): string {
  return `${String(date.getMonth() + 1)}월`;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { transactions, fetchTransactions } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const now = new Date();
  const currentMonthKey = getMonthKey(now);

  // 이번 달 거래
  const monthTx = useMemo(
    () => transactions.filter((t) => t.transacted_at.startsWith(currentMonthKey)),
    [transactions, currentMonthKey]
  );

  // 수입/지출/잔액
  const incomeTotal = useMemo(
    () => monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );
  const expenseTotal = useMemo(
    () => monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );
  const balance = incomeTotal - expenseTotal;

  // 카테고리별 지출 도넛 차트
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = t.category_id ?? "__none__";
        map[key] = (map[key] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([catId, value], idx) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          value,
          color: cat?.color ?? CHART_COLORS[idx % CHART_COLORS.length],
          label: cat?.name ?? "기타",
        };
      });
  }, [monthTx, categories]);

  // 최근 5건
  const recentTx = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime())
        .slice(0, 5),
    [transactions]
  );

  // 최근 6개월 월별 지출 바 차트
  const barData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const key = getMonthKey(d);
      const total = transactions
        .filter((t) => t.type === "expense" && t.transacted_at.startsWith(key))
        .reduce((s, t) => s + t.amount, 0);
      return { value: total, label: monthLabel(d), frontColor: theme.colors.primary };
    });
  }, [transactions]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  const amountColor = (type: TxType) => {
    if (type === "income") return theme.colors.income;
    if (type === "expense") return theme.colors.expense;
    return theme.colors.transfer;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{user?.name}님, 안녕하세요</Text>
        <Text style={styles.subTitle}>{now.getFullYear()}년 {now.getMonth() + 1}월</Text>
      </View>

      {/* 이번 달 요약 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>이번 달 요약</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>수입</Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.income }]}>
              {incomeTotal.toLocaleString("ko-KR")}원
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>지출</Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>
              {expenseTotal.toLocaleString("ko-KR")}원
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>잔액</Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.primary }]}>
              {balance.toLocaleString("ko-KR")}원
            </Text>
          </View>
        </View>
      </View>

      {/* 카테고리별 지출 도넛 차트 */}
      {pieData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>카테고리별 지출</Text>
          <View style={styles.pieContainer}>
            <PieChart
              data={pieData}
              donut
              radius={80}
              innerRadius={50}
              centerLabelComponent={() => (
                <View style={styles.pieCenter}>
                  <Text style={styles.pieCenterLabel}>지출</Text>
                  <Text style={styles.pieCenterAmount}>
                    {expenseTotal.toLocaleString("ko-KR")}
                  </Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legend}>
            {pieData.map((d, i) => (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>{d.label}</Text>
                <Text style={styles.legendAmount}>{d.value.toLocaleString("ko-KR")}원</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 최근 거래 */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>최근 거래</Text>
          <TouchableOpacity onPress={() => navigation.navigate("거래")}>
            <Text style={styles.seeAll}>전체 보기 →</Text>
          </TouchableOpacity>
        </View>
        {recentTx.length === 0 ? (
          <Text style={styles.emptyText}>거래 내역이 없습니다.</Text>
        ) : (
          recentTx.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txDot, { backgroundColor: amountColor(tx.type as TxType) }]} />
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>
                  {tx.description ?? TYPE_LABELS[tx.type as TxType]}
                </Text>
                {getCategoryName(tx.category_id) && (
                  <Text style={styles.txCategory}>{getCategoryName(tx.category_id)}</Text>
                )}
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: amountColor(tx.type as TxType) }]}>
                  {formatAmount(tx.type as TxType, tx.amount)}
                </Text>
                <Text style={styles.txDate}>{formatDate(tx.transacted_at)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 월별 지출 트렌드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>월별 지출 트렌드</Text>
        <View style={styles.barContainer}>
          <BarChart
            data={barData}
            barWidth={28}
            spacing={16}
            roundedTop
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: theme.colors.text.hint, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.text.secondary, fontSize: 11 }}
            noOfSections={4}
            barBorderRadius={4}
            hideRules={false}
            rulesColor={theme.colors.border}
            rulesType="solid"
            width={260}
            maxValue={
              Math.max(...barData.map((d) => d.value), 1) * 1.2
            }
          />
        </View>
      </View>
    </ScrollView>
  );
}

const TYPE_LABELS: Record<TxType, string> = {
  income: "수입",
  expense: "지출",
  transfer: "이체",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  header: { marginBottom: theme.spacing.md, paddingTop: theme.spacing.lg },
  greeting: {
    ...theme.typography.h1,
    color: theme.colors.text.primary,
  },
  subTitle: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  summaryAmount: { fontSize: 16, fontWeight: "700" },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
  },
  pieContainer: { alignItems: "center", marginBottom: theme.spacing.sm },
  pieCenter: { alignItems: "center" },
  pieCenterLabel: { fontSize: 11, color: theme.colors.text.secondary },
  pieCenterAmount: { fontSize: 14, fontWeight: "700", color: theme.colors.text.primary },
  legend: { marginTop: theme.spacing.sm },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing.sm },
  legendLabel: { flex: 1, ...theme.typography.caption, color: theme.colors.text.secondary },
  legendAmount: { ...theme.typography.caption, color: theme.colors.text.primary, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  seeAll: { ...theme.typography.caption, color: theme.colors.primary },
  emptyText: { ...theme.typography.body, color: theme.colors.text.hint, textAlign: "center", paddingVertical: theme.spacing.md },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  txDot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing.sm },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 15, fontWeight: "600", color: theme.colors.text.primary },
  txCategory: { ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontWeight: "600" },
  txDate: { ...theme.typography.caption, color: theme.colors.text.hint, marginTop: 2 },
  barContainer: { alignItems: "center", marginTop: theme.spacing.sm },
});
