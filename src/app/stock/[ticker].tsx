import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { OutlookCard } from '@/components/OutlookCard';
import { PriceChart } from '@/components/PriceChart';
import { NewsCard, ReturnsRow, SignalsCard, SourcesFooter, StatsCard, SummaryCard } from '@/components/Sections';
import { fetchAnalysis } from '@/lib/api';
import { signed, signedPct, usd } from '@/lib/format';
import { addRecent } from '@/lib/recent';
import { dirColor, useTheme } from '@/lib/theme';
import type { Analysis } from '@/lib/types';

export default function StockScreen() {
  const { ticker: raw } = useLocalSearchParams<{ ticker: string }>();
  const ticker = String(raw ?? '').toUpperCase();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    (refresh: boolean) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      fetchAnalysis(ticker, refresh, c.signal)
        .then((a) => {
          if (c.signal.aborted) return;
          setData(a);
          setError(null);
          addRecent({ ticker: a.quote.ticker, name: a.quote.name });
        })
        .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => !c.signal.aborted && setRefreshing(false));
    },
    [ticker],
  );

  useEffect(() => {
    run(false);
    return () => ctrl.current?.abort();
  }, [run]);

  const refresh = () => {
    setRefreshing(true);
    run(true);
  };

  const retry = () => {
    setError(null);
    run(false);
  };

  const title = <Stack.Screen options={{ title: ticker }} />;

  if (!data && !error) {
    return (
      <View style={styles.center}>
        {title}
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loading, { color: theme.subtext }]}>
          {ticker}의 시세·뉴스·재무 정보를 수집하고 분석하는 중…
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        {title}
        <Text style={[styles.errTitle, { color: theme.text }]}>분석하지 못했어요</Text>
        <Text style={[styles.loading, { color: theme.subtext }]}>{error}</Text>
        <Pressable onPress={retry} style={[styles.retry, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const q = data.quote;
  const color = dirColor(theme, q.change);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}>
      {title}
      {error ? <Text style={[styles.banner, { color: theme.down }]}>새로고침 실패: {error}</Text> : null}

      <Card>
        <Text style={[styles.name, { color: theme.subtext }]} numberOfLines={1}>
          {q.name} · {q.exchange}
        </Text>
        <Text style={[styles.price, { color: theme.text }]}>{usd(q.price)}</Text>
        <Text style={[styles.change, { color }]}>
          {signed(q.change)} ({signedPct(q.changePercent)})
        </Text>
        <View style={{ marginTop: 14 }}>
          <PriceChart points={data.chart} />
        </View>
        <ReturnsRow a={data} />
      </Card>

      <OutlookCard outlook={data.outlook} />
      <SummaryCard lines={data.summary} />
      <SignalsCard signals={data.outlook.signals} />
      <NewsCard a={data} />
      <StatsCard a={data} />
      <SourcesFooter a={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loading: { marginTop: 14, textAlign: 'center', lineHeight: 20 },
  errTitle: { fontSize: 18, fontWeight: '700' },
  retry: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  banner: { marginBottom: 8, textAlign: 'center' },
  name: { fontSize: 14 },
  price: { fontSize: 34, fontWeight: '800', marginTop: 4 },
  change: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
