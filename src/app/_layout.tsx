import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/lib/theme';

export default function RootLayout() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.accent,
          headerTitleStyle: { color: theme.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="index" options={{ title: 'US 주식 브리핑' }} />
        <Stack.Screen name="stock/[ticker]" options={{ title: '' }} />
        <Stack.Screen name="recommend" options={{ title: '상승 전망 TOP 10' }} />
      </Stack>
    </>
  );
}
