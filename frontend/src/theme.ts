// frontend/src/theme.ts
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
} as const;
