// frontend/src/theme.ts
import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#FFFFFF",
    surface: "#F8F9FA",
    border: "#F0F0F0",
    primary: "#3182F6",
    income: "#22C55E",
    expense: "#F04452",
    transfer: "#8B95A1",
    text: {
      primary: "#191F28",
      secondary: "#6B7684",
      hint: "#B0B8C1",
    },
    semantic: {
      success: "#22C55E",
      warning: "#F59E0B",
      error: "#F04452",
      info: "#3182F6",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  typography: {
    h1: { fontSize: 24, fontWeight: "700" as const },
    h2: { fontSize: 20, fontWeight: "700" as const },
    body: { fontSize: 16 },
    caption: { fontSize: 13 },
  },
  shadow: {
    sm: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
    })!,
    md: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    })!,
    lg: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    })!,
  },
  opacity: {
    disabled: 0.4,
    pressed: 0.7,
    overlay: 0.4,
  },
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
} as const;
