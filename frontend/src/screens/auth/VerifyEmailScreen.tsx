// frontend/src/screens/auth/VerifyEmailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import { theme } from "../../theme";

const COOLDOWN_SECONDS = 300;

export default function VerifyEmailScreen() {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, isLoading, verifyEmail, resendVerification, logout } =
    useAuthStore();

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("오류", "6자리 인증코드를 입력해주세요.");
      return;
    }
    try {
      await verifyEmail(code);
    } catch (error: any) {
      const message = error.response?.data?.detail ?? "인증에 실패했습니다.";
      Alert.alert("인증 실패", message);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification();
      startCooldown();
      Alert.alert("발송 완료", "인증코드가 재발송되었습니다.");
    } catch (error: any) {
      const message = error.response?.data?.detail ?? "재발송에 실패했습니다.";
      Alert.alert("재발송 실패", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>이메일 인증</Text>
        <Text style={styles.description}>
          <Text style={styles.email}>{user?.email}</Text>
          {"\n"}으로 인증코드를 보냈습니다.
        </Text>

        <TextInput
          style={styles.codeInput}
          placeholder="인증코드 6자리"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          editable={!isLoading}
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>인증하기</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResend}
          disabled={cooldown > 0}
          style={styles.resendButton}
        >
          <Text
            style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}
          >
            {cooldown > 0
              ? `코드 재발송 (${cooldown}초 후 가능)`
              : "코드를 못 받으셨나요? 재발송"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: theme.colors.text.primary,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  email: {
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 16,
    marginBottom: theme.spacing.md,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 8,
    color: theme.colors.text.primary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resendButton: { alignItems: "center", marginBottom: theme.spacing.lg },
  resendText: { color: theme.colors.primary, fontSize: 14 },
  resendDisabled: { color: theme.colors.text.hint },
  logoutButton: { alignItems: "center" },
  logoutText: { color: theme.colors.text.hint, fontSize: 14 },
});
