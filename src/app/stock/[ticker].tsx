import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { OutlookCard } from '@/components/OutlookCard';
import { PriceChart } from '@/components/PriceChart';
import { MetricsCard, NewsCard, ReturnsRow, SignalsCard, SourcesFooter, StatsCard, SummaryCard } from '@/components/Sections';
import { fetchReport, NotFoundError } from '@/lib/api';
import { signed, signedPct, timeAgo, usd } from '@/lib/format';
import { isPending, POLL_MS, refreshReports, startReport } from '@/lib/reports';
import { dirColor, useTheme } from '@/lib/theme';
import type { Report } from '@/lib/types';

export default function StockScreen() {
  const { ticker: raw } = useLocalSearchParams<{ ticker: string }>();
  const ticker = String(raw ?? '').toUpperCase();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    fetchReport(ticker, c.signal)
      // Opened before anything was requested (e.g. a deep link): start collecting now.
      .catch((e) => (e instanceof NotFoundError ? startReport(ticker).then(() => fetchReport(ticker, c.signal)) : Promise.reject(e)))
      .then((r) => {
        if (c.signal.aborted) return;
        setReport(r);
        setError(null);
      })
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : String(e)));
  }, [ticker]);

  useEffect(() => {
    load();
    return () => ctrl.current?.abort();
  }, [load]);

  // Poll while the server is still collecting; also keep the home list in step.
  const pending = report ? isPending(report.status) : false;
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(load, POLL_MS);
    return () => {
      clearInterval(id);
      refreshReports();
    };
  }, [pending, load]);

  const recollect = () => {
    setError(null);
    startReport(ticker)
      .then(load)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const title = <Stack.Screen options={{ title: ticker }} />;
  const data = report?.analysis ?? null;

  if (!data && (pending || (!report && !error))) {
    return (
      <View style={styles.center}>
        {title}
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loading, { color: theme.subtext }]}>
          서버가 {ticker}의 시세·뉴스·재무 정보를 수집하고 있어요.{'\n'}화면을 나가도 수집은 계속되고, 끝나면 홈의 분석 목록에서 볼 수 있어요.
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        {title}
        <Text style={[styles.errTitle, { color: theme.text }]}>분석하지 못했어요</Text>
        <Text style={[styles.loading, { color: theme.subtext }]}>{error ?? report?.error}</Text>
        <Pressable onPress={report ? recollect : load} style={[styles.retry, { backgroundColor: theme.accent }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>다시 요청</Text>
        </Pressable>
      </View>
    );
  }

  let banner: { text: string; color: string } | null = null;
  if (pending) banner = { text: '최신 자료를 새로 수집하는 중이에요. 끝나면 자동으로 바뀌어요.', color: theme.accent };
  else if (error) banner = { text: `요청 실패: ${error}`, color: theme.down };
  else if (report?.status === 'error') banner = { text: `새로 수집하지 못했어요: ${report.error}`, color: theme.down };

  const q = data.quote;
  const color = dirColor(theme, q.change);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={recollect} tintColor={theme.accent} />}>
      {title}
      {banner ? <Text style={[styles.banner, { color: banner.color }]}>{banner.text}</Text> : null}
      <Text style={[styles.asOf, { color: theme.subtext }]}>
        {timeAgo(data.generatedAt)} 수집{pending ? '' : ' · 당겨서 새로 수집'}
      </Text>

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
      {data.metrics?.length ? <MetricsCard a={data} metrics={data.metrics} /> : null}
      <SignalsCard signals={data.outlook.signals} />
      <NewsCard a={data} />
      {data.metrics?.length ? null : <StatsCard a={data} />}
      <SourcesFooter a={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loading: { marginTop: 14, textAlign: 'center', lineHeight: 20 },
  errTitle: { fontSize: 18, fontWeight: '700' },
  retry: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  banner: { marginBottom: 6, textAlign: 'center', lineHeight: 20 },
  asOf: { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  name: { fontSize: 14 },
  price: { fontSize: 34, fontWeight: '800', marginTop: 4 },
  change: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
