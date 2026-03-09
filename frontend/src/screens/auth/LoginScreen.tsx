// frontend/src/screens/auth/LoginScreen.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../../store/authStore";
import { TextInputField } from "../../components/ui";
import { theme } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, isLoading } = useAuthStore();

  const validateEmail = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrors(e => ({ ...e, email: "이메일을 입력해주세요." }));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors(e => ({ ...e, email: "올바른 이메일 형식이 아닙니다." }));
    } else {
      setErrors(e => ({ ...e, email: undefined }));
    }
  };

  const validatePassword = () => {
    if (!password.trim()) {
      setErrors(e => ({ ...e, password: "비밀번호를 입력해주세요." }));
    } else {
      setErrors(e => ({ ...e, password: undefined }));
    }
  };

  const handleLogin = async () => {
    const newErrors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    if (!password.trim()) {
      newErrors.password = "비밀번호를 입력해주세요.";
    }

    if (newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (error: any) {
      const message = error.response?.data?.detail ?? "Login failed. Please try again.";
      Alert.alert("Login Failed", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Benefit Butler</Text>

        <TextInputField
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors(e => ({ ...e, email: undefined }));
          }}
          onBlur={validateEmail}
          editable={!isLoading}
          accessibilityLabel="이메일 입력"
          error={errors.email}
          containerStyle={styles.fieldContainer}
        />
        <TextInputField
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors(e => ({ ...e, password: undefined }));
          }}
          onBlur={validatePassword}
          editable={!isLoading}
          accessibilityLabel="비밀번호 입력"
          error={errors.password}
          containerStyle={styles.fieldContainer}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          accessibilityLabel="로그인"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")} accessibilityLabel="회원가입 화면으로 이동">
          <Text style={styles.link}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 32, textAlign: "center" },
  fieldContainer: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", color: theme.colors.primary, fontSize: 14 },
});
