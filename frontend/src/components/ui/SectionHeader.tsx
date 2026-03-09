import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../theme";

interface SectionHeaderProps {
  title: string;
  count?: string;
  rightElement?: React.ReactNode;
}

export function SectionHeader({
  title,
  count,
  rightElement,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
      {rightElement}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  title: {
    ...theme.typography.caption,
    fontWeight: "700",
    color: theme.colors.text.secondary,
  },
  count: {
    ...theme.typography.caption,
    color: theme.colors.text.hint,
    fontWeight: "600",
  },
});
