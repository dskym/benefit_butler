import React from "react";
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  dot?: boolean;
  badge?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  color,
  dot = false,
  badge,
  style,
  accessibilityLabel,
}: ChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipSelected,
        selected && color ? { borderColor: color } : undefined,
        style,
      ]}
      onPress={onPress}
      activeOpacity={theme.opacity.pressed}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {dot && color && (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
      {badge}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#EEF5FF",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});
