// frontend/src/screens/analysis/CardPerformanceScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { apiClient } from "../../services/api";
import { CardPerformanceItem, Transaction } from "../../types";
import { theme } from "../../theme";

function fmt(amount: number) {
  return Math.round(amount).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";
}

function fmtDate(iso: string) {
  // "2026-02-01" → "2/1"
  const [, m, d] = iso.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export default function CardPerformanceScreen() {
  const route = useRoute<any>();
  const item: CardPerformanceItem = route.params?.item;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    (async () => {
      setIsLoading(true);
      try {
        const { data } = await apiClient.get("/transactions/", {
          params: {
            card_id: item.card_id,
            from: item.period_start,
            to: item.period_end,
          },
        });
        setTransactions(data);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8, textAlign: 'center' }}>데이터 로드 실패</Text>
        <Text style={{ fontSize: 14, color: theme.colors.text.hint, textAlign: 'center', lineHeight: 20 }}>데이터를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const pct = item.achievement_percent ?? 0;
  const achieved = item.monthly_target !== null && item.current_spending >= item.monthly_target;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Performance summary card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>💳</Text>
          <Text style={styles.cardName}>{item.card_name}</Text>
          {achieved && (
            <View style={styles.achievedBadge}>
              <Text style={styles.achievedBadgeText}>실적 달성 ✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.periodLabel}>
          집계 기간: {fmtDate(item.period_start)} ~ {fmtDate(item.period_end)}
        </Text>

        <View style={styles.separator} />

        {item.monthly_target === null ? (
          <Text style={styles.noTarget}>목표 미설정 — 카드 관리에서 목표를 설정해보세요.</Text>
        ) : (
          <>
            <View style={styles.amountRow}>
              <Text style={styles.spentAmt}>{fmt(item.current_spending)}</Text>
              <Text style={styles.amountSep}> / </Text>
              <Text style={styles.targetAmt}>{fmt(item.monthly_target)}</Text>
            </View>

            <View style={styles.progressRow}>
              <View style={[styles.progressBg, { flex: 1 }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(Math.min(pct, 100))}%` as any,
                      backgroundColor: achieved ? theme.colors.income : theme.colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.pctText}>{Math.round(Math.min(pct, 100))}%</Text>
            </View>

            {!achieved && item.remaining !== null && item.remaining > 0 && (
              <Text style={styles.remainingMsg}>
                {fmt(item.remaining)} 더 쓰면 이번 달 실적 달성!
              </Text>
            )}
          </>
        )}
      </View>

      {/* Transaction list */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이번 기간 거래</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
        ) : transactions.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>💳</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 8, textAlign: 'center' }}>결제 내역 없음</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text.hint, textAlign: 'center', lineHeight: 20 }}>이 기간에 이 카드로 결제한 내역이 없습니다.</Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txItem}>
              <View style={styles.txLeft}>
                <Text style={styles.txDesc} numberOfLines={1}>
                  {tx.description ?? "내역 없음"}
                </Text>
                <Text style={styles.txDate}>
                  {tx.transacted_at.slice(0, 10).replace(/-(\d{2})-(\d{2})$/, (_, m, d) => `/${parseInt(m)}/${parseInt(d)}`)}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: theme.colors.expense }]}>
                -{fmt(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardIcon: { fontSize: 18 },
  cardName: { flex: 1, fontSize: 18, fontWeight: "700", color: theme.colors.text.primary },
  achievedBadge: {
    backgroundColor: theme.colors.income,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  achievedBadgeText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  periodLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
  },

  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },

  noTarget: { fontSize: 14, color: theme.colors.text.hint, paddingVertical: theme.spacing.sm },

  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: theme.spacing.sm,
  },
  spentAmt: { fontSize: 24, fontWeight: "700", color: theme.colors.text.primary },
  amountSep: { fontSize: 16, color: theme.colors.text.hint },
  targetAmt: { fontSize: 16, color: theme.colors.text.secondary },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  progressBg: { height: 8, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  pctText: { fontSize: 14, fontWeight: "700", color: theme.colors.text.secondary, minWidth: 42, textAlign: "right" },

  remainingMsg: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "600",
    marginTop: theme.spacing.xs,
  },

  sectionTitle: { ...theme.typography.h2, color: theme.colors.text.primary, marginBottom: theme.spacing.md },

  txItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  txLeft: { flex: 1, marginRight: theme.spacing.sm },
  txDesc: { fontSize: 15, color: theme.colors.text.primary },
  txDate: { fontSize: 12, color: theme.colors.text.hint, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },

});
