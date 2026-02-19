// frontend/src/screens/dashboard/DashboardScreen.tsx
import React from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";

export default function DashboardScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    // Alert.alert은 Expo Web에서 no-op이므로 웹은 window.confirm으로 분기
    if (Platform.OS === "web") {
      if (window.confirm("정말 로그아웃할까요?")) logout();
      return;
    }
    Alert.alert("로그아웃", "정말 로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>안녕하세요, {user?.name}님</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  greeting: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
  email: { fontSize: 14, color: "#666", marginBottom: 48 },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: { color: "#ef4444", fontSize: 16 },
});
