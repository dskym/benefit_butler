// frontend/src/screens/settings/SettingsScreen.tsx
import React from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store/authStore";
import { useFinancialImportStore } from "../../store/financialImportStore";
import { useSyncStatusStore } from "../../store/syncStatusStore";
import { usePendingMutationsStore } from "../../store/pendingMutationsStore";
import { syncService } from "../../services/syncService";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { theme } from "../../theme";

function formatLastSync(ts: number | null): string {
  if (!ts) return '동기화 기록 없음';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '방금 전';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const {
    isSmsEnabled,
    isPushEnabled,
    isImporting,
    setSmsEnabled,
    setPushEnabled,
  } = useFinancialImportStore();
  const { isOnline } = useNetworkStatus();
  const isSyncing = useSyncStatusStore((s) => s.isSyncing);
  const lastSyncAt = useSyncStatusStore((s) => s.lastSyncAt);
  const syncError = useSyncStatusStore((s) => s.syncError);
  const pendingCount = usePendingMutationsStore((s) => s.queue.length);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("정말 로그아웃할까요?")) logout();
      return;
    }
    Alert.alert("로그아웃", "정말 로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => logout() },
    ]);
  };

  // 이니셜: name의 첫 글자 (영문이면 대문자, 한글이면 그대로)
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 프로필 카드 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* 관리 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>관리</Text>
        <View style={styles.sectionCard}>
          {Platform.OS === 'android' && (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>SMS 자동 임포트</Text>
                  <Text style={styles.rowSub}>
                    {isImporting ? '가져오는 중...' : '금융 SMS 거래 자동 추가'}
                  </Text>
                </View>
                <Switch
                  value={isSmsEnabled}
                  onValueChange={setSmsEnabled}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                  thumbColor="#fff"
                  disabled={isImporting}
                />
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>푸시 알림 자동 임포트</Text>
                  <Text style={styles.rowSub}>금융앱 푸시 알림 거래 자동 추가</Text>
                </View>
                <Switch
                  value={isPushEnabled}
                  onValueChange={setPushEnabled}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                  thumbColor="#fff"
                />
              </View>
              {isPushEnabled && (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowLabel, { color: theme.colors.primary }]}>
                    알림 접근 권한 설정
                  </Text>
                  <Text style={styles.rowChevron}>›</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("CategoryList")}
            activeOpacity={0.7}
            accessibilityLabel="카테고리 관리"
          >
            <Text style={styles.rowLabel}>카테고리 관리</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => navigation.navigate("CardList")}
            activeOpacity={0.7}
            accessibilityLabel="카드 관리"
          >
            <Text style={styles.rowLabel}>카드 관리</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 데이터 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>데이터</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("Import")}
            activeOpacity={0.7}
            accessibilityLabel="Excel 가져오기"
          >
            <Text style={styles.rowLabel}>Excel 가져오기</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => navigation.navigate("Export")}
            activeOpacity={0.7}
            accessibilityLabel="Excel 내보내기"
          >
            <Text style={styles.rowLabel}>Excel 내보내기</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 데이터 동기화 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>데이터 동기화</Text>
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>미동기화 항목</Text>
            <Text style={[styles.rowValue, pendingCount > 0 && { color: '#FF9500' }]}>
              {pendingCount}개
            </Text>
          </View>
          <View style={[styles.row, !syncError && styles.rowLast]}>
            <Text style={styles.rowLabel}>마지막 동기화</Text>
            <Text style={styles.rowValue}>{formatLastSync(lastSyncAt)}</Text>
          </View>
          {syncError && (
            <View style={[styles.row, styles.rowLast]}>
              <Text style={styles.syncError}>{syncError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.syncButton,
              (!isOnline || pendingCount === 0 || isSyncing) && styles.syncButtonDisabled,
            ]}
            onPress={() => syncService.flush()}
            disabled={!isOnline || pendingCount === 0 || isSyncing}
            activeOpacity={0.7}
            accessibilityLabel="지금 동기화"
          >
            <Text style={styles.syncButtonText}>
              {isSyncing ? '동기화 중...' : '지금 동기화'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 앱 정보 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>앱 정보</Text>
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => navigation.navigate("PrivacyPolicy")}
            activeOpacity={0.7}
            accessibilityLabel="개인정보 처리방침"
          >
            <Text style={styles.rowLabel}>개인정보 처리방침</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 로그아웃 버튼 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7} accessibilityLabel="로그아웃">
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  header: { marginBottom: theme.spacing.md, paddingTop: theme.spacing.lg },
  headerTitle: { ...theme.typography.h1, color: theme.colors.text.primary },
  profileCard: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { ...theme.typography.h2, color: theme.colors.text.primary },
  profileEmail: { ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 },
  section: { marginBottom: theme.spacing.md },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { flex: 1, fontSize: 16, color: theme.colors.text.primary },
  rowChevron: { fontSize: 20, color: theme.colors.text.hint },
  rowValue: { fontSize: 15, color: theme.colors.text.secondary },
  rowSub: { fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 },
  syncButton: {
    margin: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  syncButtonDisabled: { backgroundColor: theme.colors.border },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  syncError: { fontSize: 12, color: theme.colors.expense, flex: 1 },
  logoutBtn: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.expense,
    marginTop: theme.spacing.sm,
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: theme.colors.expense },
});
