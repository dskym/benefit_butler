// frontend/src/screens/auth/RegisterScreen.tsx
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

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const { register, isLoading } = useAuthStore();

  const validateName = () => {
    if (!name.trim()) {
      setErrors(e => ({ ...e, name: "이름을 입력해주세요." }));
    } else {
      setErrors(e => ({ ...e, name: undefined }));
    }
  };

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
    } else if (password.length < 6) {
      setErrors(e => ({ ...e, password: "비밀번호는 6자 이상이어야 합니다." }));
    } else {
      setErrors(e => ({ ...e, password: undefined }));
    }
  };

  const handleRegister = async () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};

    if (!name.trim()) {
      newErrors.name = "이름을 입력해주세요.";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    if (!password.trim()) {
      newErrors.password = "비밀번호를 입력해주세요.";
    } else if (password.length < 6) {
      newErrors.password = "비밀번호는 6자 이상이어야 합니다.";
    }

    if (newErrors.name || newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    try {
      await register(email.trim(), password, name.trim());
    } catch (error: any) {
      const message = error.response?.data?.detail ?? "Registration failed. Please try again.";
      Alert.alert("Registration Failed", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create Account</Text>

        <TextInputField
          placeholder="Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors(e => ({ ...e, name: undefined }));
          }}
          onBlur={validateName}
          editable={!isLoading}
          accessibilityLabel="이름 입력"
          error={errors.name}
          containerStyle={styles.fieldContainer}
        />
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
          placeholder="Password (min 6 characters)"
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
          onPress={handleRegister}
          disabled={isLoading}
          accessibilityLabel="회원가입"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="로그인 화면으로 이동">
          <Text style={styles.link}>Already have an account? Log in</Text>
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
