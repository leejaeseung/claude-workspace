import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { migrateDatabase } from "../db/schema";
import { seedSampleRecipesIfEmpty } from "../db/seed";
import { useAppTheme } from "../theme";
import { useSettingsStore } from "../store/settingsStore";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const scheme = useColorScheme();
  const theme = useAppTheme();
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    migrateDatabase()
      .then(() => seedSampleRecipesIfEmpty())
      .then(() => loadSettings())
      .then(() => setIsReady(true));
  }, [loadSettings]);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack>
        <Stack.Screen name="index" options={{ title: "레시피 모음집" }} />
        <Stack.Screen name="settings" options={{ title: "설정" }} />
        <Stack.Screen name="manual-edit" options={{ title: "레시피 추가" }} />
        <Stack.Screen name="recipe/[id]/index" options={{ title: "레시피 상세" }} />
        <Stack.Screen
          name="recipe/[id]/cook"
          options={{ title: "요리 모드", headerShown: false }}
        />
        <Stack.Screen name="recipe/[id]/ingredients" options={{ title: "재료" }} />
      </Stack>
    </ThemeProvider>
  );
}
