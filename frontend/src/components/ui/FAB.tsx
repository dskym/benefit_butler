import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../../theme";

interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function FAB({
  onPress,
  icon,
  accessibilityLabel = "추가",
  style,
}: FABProps) {
  return (
    <TouchableOpacity
      style={[styles.fab, style]}
      onPress={onPress}
      activeOpacity={theme.opacity.pressed}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {icon ?? <Text style={styles.fabText}>+</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.lg,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 32,
  },
});
