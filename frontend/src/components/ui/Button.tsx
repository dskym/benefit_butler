import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { theme } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  flex?: number;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  flex,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        flex !== undefined && { flex },
        isDisabled && { opacity: theme.opacity.disabled },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={theme.opacity.pressed}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? "#fff" : theme.colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              sizeTextStyles[size],
              variantTextStyles[variant],
              icon ? { marginLeft: 6 } : undefined,
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  text: {
    fontWeight: "600",
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { paddingVertical: 8, paddingHorizontal: 12 },
  md: { paddingVertical: 14, paddingHorizontal: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 20 },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 17 },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: theme.colors.primary },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "transparent" },
  danger: { backgroundColor: theme.colors.expense },
  ghost: { backgroundColor: "transparent" },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: "#fff" },
  secondary: { color: theme.colors.text.secondary },
  danger: { color: "#fff" },
  ghost: { color: theme.colors.primary },
};
