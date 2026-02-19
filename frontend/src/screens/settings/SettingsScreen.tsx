// frontend/src/screens/settings/SettingsScreen.tsx
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store/authStore";
import { theme } from "../../theme";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();

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
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

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
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("CategoryList")}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>카테고리 관리</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 앱 정보 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>앱 정보</Text>
        <View style={styles.sectionCard}>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* 로그아웃 버튼 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
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
