import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../theme";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonItem({
  width = "100%",
  height = 16,
  borderRadius = theme.radius.sm,
  style,
}: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface TransactionSkeletonProps {
  count?: number;
}

export function TransactionSkeleton({ count = 5 }: TransactionSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.left}>
            <SkeletonItem width={40} height={40} borderRadius={20} />
            <View style={styles.textGroup}>
              <SkeletonItem width={120} height={14} />
              <SkeletonItem width={80} height={12} style={{ marginTop: 6 }} />
            </View>
          </View>
          <SkeletonItem width={80} height={16} />
        </View>
      ))}
    </View>
  );
}

export { SkeletonItem };

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  textGroup: {
    marginLeft: 12,
  },
});
