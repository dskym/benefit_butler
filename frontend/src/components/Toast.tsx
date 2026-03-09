import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore, ToastType } from "../store/toastStore";
import { theme } from "../theme";

const TOAST_COLORS: Record<ToastType, string> = {
  success: theme.colors.semantic.success,
  error: theme.colors.semantic.error,
  info: theme.colors.semantic.info,
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2715",
  info: "\u2139",
};

export function Toast() {
  const { visible, message, type, hideToast } = useToastStore();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 2500);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, message]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start(() => {
      hideToast();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: TOAST_COLORS[type],
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={dismiss}
        activeOpacity={0.9}
        accessibilityLabel={message}
        accessibilityRole="alert"
      >
        <Text style={styles.icon}>{TOAST_ICONS[type]}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: theme.radius.md,
    zIndex: 9999,
    ...theme.shadow.md,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
