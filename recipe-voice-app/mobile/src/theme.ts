import { useColorScheme } from "react-native";

export interface AppTheme {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  placeholder: string;
  primary: string;
  primaryText: string;
  secondarySurface: string;
  secondaryText: string;
  danger: string;
  isDark: boolean;
}

const lightTheme: AppTheme = {
  background: "#ffffff",
  surface: "#f5f5f7",
  text: "#111318",
  mutedText: "#6b7280",
  border: "#d1d5db",
  placeholder: "#8a8f98",
  primary: "#2563eb",
  primaryText: "#ffffff",
  secondarySurface: "#e5e7eb",
  secondaryText: "#111318",
  danger: "#dc2626",
  isDark: false,
};

const darkTheme: AppTheme = {
  background: "#121317",
  surface: "#1c1e24",
  text: "#f2f3f5",
  mutedText: "#9aa0ac",
  border: "#3a3d45",
  // 어두운 배경에서 회색 placeholder가 거의 안 보이는 문제를 막기 위해 밝은 회색을 쓴다.
  placeholder: "#b8bcc4",
  primary: "#3b82f6",
  primaryText: "#ffffff",
  secondarySurface: "#2a2d35",
  secondaryText: "#f2f3f5",
  danger: "#ef4444",
  isDark: true,
};

/** 시스템 라이트/다크 모드에 맞는 팔레트를 반환한다. placeholder 색상도 테마별로 대비를 보장한다. */
export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}
