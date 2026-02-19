// frontend/src/screens/analysis/AnalysisScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { useTransactionStore } from "../../store/transactionStore";
import { useCategoryStore } from "../../store/categoryStore";
import { theme } from "../../theme";

const CHART_COLORS = [
  "#3182F6", "#22C55E", "#F04452", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonth(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return d;
}

function monthLabel(date: Date): string {
  return `${String(date.getMonth() + 1)}월`;
}

function monthTitle(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export default function AnalysisScreen() {
  const { transactions, fetchTransactions } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, []);

  const selectedKey = getMonthKey(selectedMonth);

  // 선택 월 거래
  const monthTx = useMemo(
    () => transactions.filter((t) => t.transacted_at.startsWith(selectedKey)),
    [transactions, selectedKey]
  );

  const incomeTotal = useMemo(
    () => monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );
  const expenseTotal = useMemo(
    () => monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [monthTx]
  );

  // 최근 6개월 grouped bar 데이터
  const groupedBarData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d;
    });
    const result: any[] = [];
    months.forEach((d, idx) => {
      const key = getMonthKey(d);
      const inc = transactions
        .filter((t) => t.type === "income" && t.transacted_at.startsWith(key))
        .reduce((s, t) => s + t.amount, 0);
      const exp = transactions
        .filter((t) => t.type === "expense" && t.transacted_at.startsWith(key))
        .reduce((s, t) => s + t.amount, 0);
      result.push({ value: inc, label: monthLabel(d), frontColor: theme.colors.income, spacing: 4 });
      result.push({ value: exp, frontColor: theme.colors.expense, spacing: idx < 5 ? 20 : 0 });
    });
    return result;
  }, [transactions]);

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

  // 지출 순위 리스트
  const expenseRanking = useMemo(() => {
    const map: Record<string, { name: string; total: number; color: string }> = {};
    monthTx
      .filter((t) => t.type === "expense")
      .forEach((t, _, arr) => {
        const key = t.category_id ?? "__none__";
        if (!map[key]) {
          const cat = categories.find((c) => c.id === t.category_id);
          const idx = Object.keys(map).length;
          map[key] = {
            name: cat?.name ?? "기타",
            total: 0,
            color: cat?.color ?? CHART_COLORS[idx % CHART_COLORS.length],
          };
        }
        map[key].total += t.amount;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthTx, categories]);

  const maxExpense = expenseRanking[0]?.total ?? 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 헤더 + 월 선택기 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>분석</Text>
        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => setSelectedMonth((m) => addMonth(m, -1))}
          >
            <Text style={styles.monthArrowText}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthTitle(selectedMonth)}</Text>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => setSelectedMonth((m) => addMonth(m, 1))}
          >
            <Text style={styles.monthArrowText}>{">"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 이번 달 요약 */}
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
        </View>
      </View>

      {/* 수입 vs 지출 바 차트 (최근 6개월) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>수입 vs 지출 (최근 6개월)</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.income }]} />
            <Text style={styles.legendText}>수입</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.expense }]} />
            <Text style={styles.legendText}>지출</Text>
          </View>
        </View>
        <View style={styles.chartContainer}>
          <BarChart
            data={groupedBarData}
            barWidth={16}
            spacing={4}
            roundedTop
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: theme.colors.text.hint, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.text.secondary, fontSize: 10 }}
            noOfSections={4}
            barBorderRadius={3}
            hideRules={false}
            rulesColor={theme.colors.border}
            rulesType="solid"
            width={260}
            maxValue={Math.max(...groupedBarData.map((d) => d.value), 1) * 1.2}
          />
        </View>
      </View>

      {/* 카테고리별 지출 도넛 차트 */}
      {pieData.length > 0 ? (
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
          <View style={styles.pieLegend}>
            {pieData.map((d, i) => (
              <View key={i} style={styles.pieLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.pieLegendLabel} numberOfLines={1}>{d.label}</Text>
                <Text style={styles.pieLegendAmount}>{d.value.toLocaleString("ko-KR")}원</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>카테고리별 지출</Text>
          <Text style={styles.emptyText}>이번 달 지출 내역이 없습니다.</Text>
        </View>
      )}

      {/* 지출 순위 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>지출 순위</Text>
        {expenseRanking.length === 0 ? (
          <Text style={styles.emptyText}>지출 내역이 없습니다.</Text>
        ) : (
          expenseRanking.map((item, idx) => {
            const pct = maxExpense > 0 ? item.total / maxExpense : 0;
            return (
              <View key={idx} style={styles.rankItem}>
                <View style={styles.rankHeader}>
                  <View style={styles.rankLeft}>
                    <Text style={styles.rankIndex}>{idx + 1}</Text>
                    <View style={[styles.rankDot, { backgroundColor: item.color }]} />
                    <Text style={styles.rankName}>{item.name}</Text>
                  </View>
                  <Text style={styles.rankAmount}>{item.total.toLocaleString("ko-KR")}원</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: item.color }]} />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  header: {
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  headerTitle: { ...theme.typography.h1, color: theme.colors.text.primary, marginBottom: theme.spacing.md },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
  },
  monthArrow: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xs },
  monthArrowText: { fontSize: 18, color: theme.colors.primary, fontWeight: "700" },
  monthLabel: { ...theme.typography.h2, color: theme.colors.text.primary, minWidth: 140, textAlign: "center" },
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardTitle: { ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: theme.spacing.md },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: theme.spacing.xs },
  summaryAmount: { fontSize: 18, fontWeight: "700" },
  summaryDivider: { width: 1, height: 40, backgroundColor: theme.colors.border },
  legendRow: { flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...theme.typography.caption, color: theme.colors.text.secondary },
  chartContainer: { alignItems: "center" },
  pieContainer: { alignItems: "center", marginBottom: theme.spacing.sm },
  pieCenter: { alignItems: "center" },
  pieCenterLabel: { fontSize: 11, color: theme.colors.text.secondary },
  pieCenterAmount: { fontSize: 14, fontWeight: "700", color: theme.colors.text.primary },
  pieLegend: { marginTop: theme.spacing.sm },
  pieLegendItem: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.xs },
  pieLegendLabel: { flex: 1, ...theme.typography.caption, color: theme.colors.text.secondary },
  pieLegendAmount: { ...theme.typography.caption, color: theme.colors.text.primary, fontWeight: "600" },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.text.hint,
    textAlign: "center",
    paddingVertical: theme.spacing.md,
  },
  rankItem: { marginBottom: theme.spacing.md },
  rankHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  rankLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  rankIndex: { fontSize: 13, fontWeight: "700", color: theme.colors.text.hint, width: 16 },
  rankDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: 14, color: theme.colors.text.primary },
  rankAmount: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  progressBg: {
    height: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3 },
});
