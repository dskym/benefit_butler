// frontend/src/screens/analysis/AnalysisScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { useTransactionStore } from "../../store/transactionStore";
import { useCategoryStore } from "../../store/categoryStore";
import { useCardStore } from "../../store/cardStore";
import { theme } from "../../theme";
import { Transaction } from "../../types";

type PeriodMode = "year" | "month" | "day";
type RankTab = "expense" | "income";

const CHART_COLORS = [
  "#3182F6", "#22C55E", "#F04452", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(amount: number) {
  const safe = isNaN(amount) ? 0 : Math.round(amount);
  return safe.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";
}

function fmtShort(amount: number): string {
  const safe = isNaN(amount) ? 0 : Math.round(amount);
  if (safe === 0) return "";
  if (safe >= 100000000) return `${Math.round(safe / 100000000)}억`;
  if (safe >= 10000) return `${Math.round(safe / 10000)}만`;
  if (safe >= 1000) return `${Math.round(safe / 1000)}천`;
  return String(safe);
}

function sumByType(txs: Transaction[], type: string) {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function aggregateByCategory(txs: Transaction[], type: "expense" | "income", categories: any[]) {
  const map: Record<string, { name: string; total: number; color: string }> = {};
  txs.filter((t) => t.type === type).forEach((t) => {
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
    map[key].total += Number(t.amount) || 0;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export default function AnalysisScreen() {
  const { transactions, fetchTransactions } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { cards, fetchCards, updateCard } = useCardStore();
  const now = new Date();

  const [mode, setMode] = useState<PeriodMode>("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [rankTab, setRankTab] = useState<RankTab>("expense");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState("");

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
    fetchCards();
  }, []);

  // --- Filtered transactions ---
  const yearTxs = useMemo(
    () => transactions.filter((t) => new Date(t.transacted_at).getFullYear() === selectedYear),
    [transactions, selectedYear]
  );

  const monthTxs = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.transacted_at);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    }),
    [transactions, selectedYear, selectedMonth]
  );

  const dayTxs = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.transacted_at);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && d.getDate() === selectedDay;
    }),
    [transactions, selectedYear, selectedMonth, selectedDay]
  );

  // --- Year view: monthly bar data ---
  const monthlyBarData = useMemo(() => {
    const result: any[] = [];
    for (let m = 0; m < 12; m++) {
      const txs = yearTxs.filter((t) => new Date(t.transacted_at).getMonth() === m);
      const inc = sumByType(txs, "income");
      const exp = sumByType(txs, "expense");
      result.push({ value: inc, label: MONTH_LABELS[m], frontColor: theme.colors.income, spacing: 4, topLabelComponent: () => inc > 0 ? <Text style={{ fontSize: 8, color: theme.colors.income }}>{fmtShort(inc)}</Text> : null });
      result.push({ value: exp, frontColor: theme.colors.expense, spacing: m < 11 ? 12 : 0, topLabelComponent: () => exp > 0 ? <Text style={{ fontSize: 8, color: theme.colors.expense }}>{fmtShort(exp)}</Text> : null });
    }
    return result;
  }, [yearTxs]);

  // --- Card spending aggregation (month view) ---
  const cardSpendings = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs
      .filter((t) => t.type === "expense" && t.user_card_id)
      .forEach((t) => {
        map[t.user_card_id!] = (map[t.user_card_id!] ?? 0) + (Number(t.amount) || 0);
      });
    return map;
  }, [monthTxs]);

  const handleSaveTarget = async (cardId: string) => {
    const raw = editingTarget.replace(/[^0-9]/g, "");
    const target = raw === "" ? null : parseInt(raw, 10);
    await updateCard(cardId, target === 0 ? null : target);
    setEditingCardId(null);
  };

  // --- Navigation ---
  const goYear = (delta: number) => setSelectedYear((y) => y + delta);
  const goMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };
  const goDay = (delta: number) => {
    const d = new Date(selectedYear, selectedMonth, selectedDay + delta);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
    setSelectedDay(d.getDate());
  };
  const handleNav = (delta: number) => {
    if (mode === "year") goYear(delta);
    else if (mode === "month") goMonth(delta);
    else goDay(delta);
  };

  const periodLabel = () => {
    if (mode === "year") return `${selectedYear}년`;
    if (mode === "month") return `${selectedYear}.${String(selectedMonth + 1).padStart(2, "0")}`;
    return `${selectedYear}.${String(selectedMonth + 1).padStart(2, "0")}.${String(selectedDay).padStart(2, "0")}`;
  };

  // --- Active transactions & totals ---
  const activeTxs = mode === "year" ? yearTxs : mode === "month" ? monthTxs : dayTxs;
  const incomeTotal = sumByType(activeTxs, "income");
  const expenseTotal = sumByType(activeTxs, "expense");
  const netTotal = incomeTotal - expenseTotal;

  // --- Pie chart (year / month views) ---
  const pieData = useMemo(() => {
    const txs = mode === "year" ? yearTxs : monthTxs;
    const map: Record<string, number> = {};
    txs.filter((t) => t.type === "expense").forEach((t) => {
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
  }, [mode, yearTxs, monthTxs, categories]);

  // --- Ranking (year / month views) ---
  const rankingTxs = mode === "year" ? yearTxs : monthTxs;
  const ranking = useMemo(
    () => aggregateByCategory(rankingTxs, rankTab, categories),
    [rankingTxs, rankTab, categories]
  );
  const maxRank = ranking[0]?.total ?? 1;

  // --- Day view: sorted transactions ---
  const dayTxsSorted = useMemo(
    () => [...dayTxs].sort((a, b) => a.transacted_at.localeCompare(b.transacted_at)),
    [dayTxs]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        {/* Period mode toggle */}
        <View style={styles.toggleRow}>
          {(["year", "month", "day"] as PeriodMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleBtnText, mode === m && styles.toggleBtnTextActive]}>
                {m === "year" ? "연도" : m === "month" ? "월" : "일"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period navigation */}
        <View style={styles.periodNav}>
          <TouchableOpacity style={styles.navArrow} onPress={() => handleNav(-1)}>
            <Text style={styles.navArrowText}>{"‹"}</Text>
          </TouchableOpacity>
          <Text style={styles.periodLabel}>{periodLabel()}</Text>
          <TouchableOpacity style={styles.navArrow} onPress={() => handleNav(1)}>
            <Text style={styles.navArrowText}>{"›"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary card */}
      <View style={styles.card}>
        {mode === "day" ? (
          <View style={styles.daySummaryRow}>
            <View style={styles.daySummaryItem}>
              <Text style={styles.summaryLabel}>수입</Text>
              <Text style={[styles.summaryAmount, { color: theme.colors.income }]}>{fmt(incomeTotal)}</Text>
            </View>
            <View style={styles.daySummaryItem}>
              <Text style={styles.summaryLabel}>지출</Text>
              <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>{fmt(expenseTotal)}</Text>
            </View>
            <View style={styles.daySummaryItem}>
              <Text style={styles.summaryLabel}>순액</Text>
              <Text style={[styles.summaryAmount, { color: netTotal >= 0 ? theme.colors.income : theme.colors.expense }]}>
                {fmt(netTotal)}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>수입</Text>
                <Text style={[styles.summaryAmount, { color: theme.colors.income }]}>{fmt(incomeTotal)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>지출</Text>
                <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>{fmt(expenseTotal)}</Text>
              </View>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>순액</Text>
              <Text style={[styles.netAmount, { color: netTotal >= 0 ? theme.colors.income : theme.colors.expense }]}>
                {netTotal >= 0 ? "+" : ""}{fmt(netTotal)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Year view: monthly bar chart */}
      {mode === "year" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>월별 수입 / 지출</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={monthlyBarData}
              barWidth={14}
              spacing={4}
              roundedTop
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: theme.colors.text.hint, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: theme.colors.text.secondary, fontSize: 9 }}
              noOfSections={4}
              barBorderRadius={3}
              rulesColor={theme.colors.border}
              rulesType="solid"
              width={360}
              maxValue={Math.max(...monthlyBarData.map((d) => isNaN(d.value) ? 0 : d.value), 1) * 1.2}
            />
          </ScrollView>
        </View>
      )}

      {/* Day view: transaction list */}
      {mode === "day" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>거래 내역</Text>
          {dayTxsSorted.length === 0 ? (
            <Text style={styles.emptyText}>이 날 거래 내역이 없습니다.</Text>
          ) : (
            dayTxsSorted.map((t) => {
              const cat = categories.find((c) => c.id === t.category_id);
              const time = t.transacted_at.length >= 16 ? t.transacted_at.slice(11, 16) : "";
              return (
                <View key={t.id} style={styles.dayTxItem}>
                  <View style={styles.dayTxLeft}>
                    {time ? <Text style={styles.dayTxTime}>{time}</Text> : null}
                    <Text style={styles.dayTxCat}>{cat?.name ?? "기타"}</Text>
                    {t.description ? <Text style={styles.dayTxDesc} numberOfLines={1}>{t.description}</Text> : null}
                  </View>
                  <Text style={[
                    styles.dayTxAmount,
                    { color: t.type === "income" ? theme.colors.income : t.type === "expense" ? theme.colors.expense : theme.colors.transfer },
                  ]}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{fmt(t.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Category donut chart (year / month views) */}
      {mode !== "day" && (
        pieData.length > 0 ? (
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
                    <Text style={styles.pieCenterAmount}>{Math.round(expenseTotal).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.pieLegend}>
              {pieData.map((d, i) => (
                <View key={i} style={styles.pieLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.pieLegendLabel} numberOfLines={1}>{d.label}</Text>
                  <Text style={styles.pieLegendAmount}>{fmt(d.value)}</Text>
                  <Text style={styles.pieLegendPct}>
                    {expenseTotal > 0 ? Math.round((d.value / expenseTotal) * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>카테고리별 지출</Text>
            <Text style={styles.emptyText}>지출 내역이 없습니다.</Text>
          </View>
        )
      )}

      {/* Card performance section (month view only) */}
      {mode === "month" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>카드 실적 현황</Text>
          {cards.length === 0 ? (
            <Text style={styles.emptyText}>설정 {">"} 카드 관리에서 카드를 등록하세요.</Text>
          ) : (
            cards.map((card) => {
              const spent = cardSpendings[card.id] ?? 0;
              const target = card.monthly_target;
              const isEditing = editingCardId === card.id;
              const achieved = target !== null && spent >= target;
              const pct = target ? Math.min(spent / target, 1) : 0;
              const remaining = target ? Math.max(target - spent, 0) : 0;

              return (
                <View key={card.id} style={styles.cardPerformanceItem}>
                  <View style={styles.cardPerfHeader}>
                    <Text style={styles.cardPerfName}>{card.name}</Text>
                    {achieved && (
                      <View style={styles.achievedBadge}>
                        <Text style={styles.achievedBadgeText}>달성!</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.cardPerfEditBtn}
                      onPress={() => {
                        setEditingCardId(card.id);
                        setEditingTarget(target !== null ? String(target) : "");
                      }}
                    >
                      <Text style={styles.cardPerfEditBtnText}>
                        {target !== null ? "수정" : "설정"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isEditing ? (
                    <View style={styles.cardPerfEditRow}>
                      <TextInput
                        style={styles.cardPerfInput}
                        value={editingTarget}
                        onChangeText={setEditingTarget}
                        keyboardType="numeric"
                        placeholder="목표 금액 (원)"
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.cardPerfSaveBtn}
                        onPress={() => handleSaveTarget(card.id)}
                      >
                        <Text style={styles.cardPerfSaveBtnText}>확인</Text>
                      </TouchableOpacity>
                    </View>
                  ) : target === null ? (
                    <Text style={styles.cardPerfNoTarget}>목표 미설정</Text>
                  ) : (
                    <>
                      <Text style={styles.cardPerfTargetLabel}>목표 {fmt(target)}</Text>
                      <View style={styles.cardPerfProgressRow}>
                        <View style={styles.progressBg}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.round(pct * 100)}%` as any,
                                backgroundColor: achieved ? theme.colors.income : theme.colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.cardPerfSpent}>{fmt(spent)}</Text>
                      </View>
                      <View style={styles.cardPerfFooter}>
                        <Text style={styles.cardPerfRemaining}>
                          {achieved ? "목표 달성" : `잔여 ${fmt(remaining)}`}
                        </Text>
                        <Text style={styles.cardPerfPct}>{Math.round(pct * 100)}%</Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Ranking (year / month views) */}
      {mode !== "day" && (
        <View style={styles.card}>
          <View style={styles.rankHeaderRow}>
            <Text style={styles.cardTitle}>순위</Text>
            <View style={styles.rankToggle}>
              <TouchableOpacity
                style={[styles.rankToggleBtn, rankTab === "expense" && styles.rankToggleBtnActive]}
                onPress={() => setRankTab("expense")}
              >
                <Text style={[styles.rankToggleBtnText, rankTab === "expense" && styles.rankToggleBtnTextActive]}>지출</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rankToggleBtn, rankTab === "income" && styles.rankToggleBtnActive]}
                onPress={() => setRankTab("income")}
              >
                <Text style={[styles.rankToggleBtnText, rankTab === "income" && styles.rankToggleBtnTextActive]}>수입</Text>
              </TouchableOpacity>
            </View>
          </View>
          {ranking.length === 0 ? (
            <Text style={styles.emptyText}>내역이 없습니다.</Text>
          ) : (
            ranking.map((item, idx) => {
              const pct = maxRank > 0 ? item.total / maxRank : 0;
              return (
                <View key={idx} style={styles.rankItem}>
                  <View style={styles.rankRow}>
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
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },

  header: { marginBottom: theme.spacing.md, paddingTop: theme.spacing.lg },
  headerTitle: { ...theme.typography.h1, color: theme.colors.text.primary, marginBottom: theme.spacing.md },

  toggleRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: theme.spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: theme.spacing.xs + 2,
    alignItems: "center",
    borderRadius: theme.radius.sm,
  },
  toggleBtnActive: { backgroundColor: theme.colors.bg },
  toggleBtnText: { fontSize: 14, fontWeight: "600", color: theme.colors.text.hint },
  toggleBtnTextActive: { color: theme.colors.primary },

  periodNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
  },
  navArrow: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xs },
  navArrowText: { fontSize: 22, color: theme.colors.primary, fontWeight: "700" },
  periodLabel: { ...theme.typography.h2, color: theme.colors.text.primary, minWidth: 140, textAlign: "center" },

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
  netRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  netLabel: { ...theme.typography.caption, color: theme.colors.text.secondary, marginRight: theme.spacing.sm },
  netAmount: { fontSize: 16, fontWeight: "700" },

  daySummaryRow: { flexDirection: "row", justifyContent: "space-around" },
  daySummaryItem: { alignItems: "center" },

  legendRow: { flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...theme.typography.caption, color: theme.colors.text.secondary },

  pieContainer: { alignItems: "center", marginBottom: theme.spacing.sm },
  pieCenter: { alignItems: "center" },
  pieCenterLabel: { fontSize: 11, color: theme.colors.text.secondary },
  pieCenterAmount: { fontSize: 14, fontWeight: "700", color: theme.colors.text.primary },
  pieLegend: { marginTop: theme.spacing.sm },
  pieLegendItem: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.xs, gap: theme.spacing.xs },
  pieLegendLabel: { flex: 1, ...theme.typography.caption, color: theme.colors.text.secondary },
  pieLegendAmount: { ...theme.typography.caption, color: theme.colors.text.primary, fontWeight: "600" },
  pieLegendPct: { ...theme.typography.caption, color: theme.colors.text.hint, minWidth: 35, textAlign: "right" },

  rankHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.md },
  rankToggle: { flexDirection: "row", backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, padding: 2 },
  rankToggleBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.sm - 2 },
  rankToggleBtnActive: { backgroundColor: theme.colors.bg },
  rankToggleBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.text.hint },
  rankToggleBtnTextActive: { color: theme.colors.primary },

  rankItem: { marginBottom: theme.spacing.md },
  rankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  rankLeft: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  rankIndex: { fontSize: 13, fontWeight: "700", color: theme.colors.text.hint, width: 16 },
  rankDot: { width: 10, height: 10, borderRadius: 5 },
  rankName: { fontSize: 14, color: theme.colors.text.primary },
  rankAmount: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  progressBg: { height: 6, backgroundColor: theme.colors.surface, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },

  dayTxItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayTxLeft: { flex: 1, marginRight: theme.spacing.sm },
  dayTxTime: { fontSize: 12, color: theme.colors.text.hint, marginBottom: 2 },
  dayTxCat: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  dayTxDesc: { fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 },
  dayTxAmount: { fontSize: 15, fontWeight: "700" },

  emptyText: {
    ...theme.typography.body,
    color: theme.colors.text.hint,
    textAlign: "center",
    paddingVertical: theme.spacing.md,
  },

  cardPerformanceItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  cardPerfHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  cardPerfName: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.text.primary },
  achievedBadge: {
    backgroundColor: theme.colors.income,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
    marginRight: theme.spacing.xs,
  },
  achievedBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  cardPerfEditBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
  },
  cardPerfEditBtnText: { fontSize: 12, color: theme.colors.primary, fontWeight: "600" },
  cardPerfNoTarget: { fontSize: 13, color: theme.colors.text.hint },
  cardPerfTargetLabel: { fontSize: 13, color: theme.colors.text.secondary, marginBottom: theme.spacing.xs },
  cardPerfProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardPerfSpent: { fontSize: 13, fontWeight: "600", color: theme.colors.text.primary, minWidth: 80, textAlign: "right" },
  cardPerfFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardPerfRemaining: { fontSize: 12, color: theme.colors.text.secondary },
  cardPerfPct: { fontSize: 12, fontWeight: "700", color: theme.colors.text.primary },
  cardPerfEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cardPerfInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  cardPerfSaveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
  },
  cardPerfSaveBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
});
