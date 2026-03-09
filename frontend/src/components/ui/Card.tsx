import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../../theme";

type ShadowLevel = "sm" | "md" | "lg" | "none";

interface CardProps {
  children: React.ReactNode;
  shadow?: ShadowLevel;
  padding?: number;
  style?: ViewStyle;
}

export function Card({
  children,
  shadow = "sm",
  padding = theme.spacing.md,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { padding },
        shadow !== "none" && theme.shadow[shadow],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
  },
});
