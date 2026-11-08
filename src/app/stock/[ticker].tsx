import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { OutlookCard } from '@/components/OutlookCard';
import { PriceChart } from '@/components/PriceChart';
import { MetricsCard, NewsCard, ReturnsRow, SignalsCard, SourcesFooter, StatsCard, SummaryCard } from '@/components/Sections';
import { fetchReport, NotFoundError } from '@/lib/api';
import { DIRECTION_LABEL, daysUntil, fmtDate, signed, signedPct, timeAgo, usd } from '@/lib/format';
import { isPending, POLL_MS, refreshReports, startReport } from '@/lib/reports';
import { dirColor, useTheme } from '@/lib/theme';
import type { Analysis, Report } from '@/lib/types';

/** Plain-text digest for the share sheet (messengers, notes). */
function shareText(a: Analysis): string {
  const q = a.quote;
  const o = a.outlook;
  const lines = [
    `[${q.ticker}] ${q.name}`,
    `${usd(q.price)} (${signedPct(q.changePercent)}) · ${new Date(a.generatedAt).toLocaleString('ko-KR')} 기준`,
    `전망: ${DIRECTION_LABEL[o.direction]} 우세 (점수 ${o.score > 0 ? '+' : ''}${o.score}) — ${o.headline}`,
    '',
    ...a.summary.map((l) => `• ${l}`),
  ];
  const good = a.metrics?.filter((m) => m.rating === 'good').map((m) => m.label) ?? [];
  const bad = a.metrics?.filter((m) => m.rating === 'bad').map((m) => m.label) ?? [];
  if (good.length || bad.length) lines.push('', `좋음: ${good.join(', ') || '-'}`, `나쁨: ${bad.join(', ') || '-'}`);
  lines.push('', a.disclaimer);
  return lines.join('\n');
}

function earningsText(ymd: string): string {
  const n = daysUntil(ymd);
  if (n > 0) return `실적 발표 ${fmtDate(ymd)} (D-${n})`;
  if (n === 0) return `오늘 실적 발표 (${fmtDate(ymd)})`;
  return `최근 실적 발표 ${fmtDate(ymd)} (${-n}일 전)`;
}

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

  const data = report?.analysis ?? null;
  const title = (
    <Stack.Screen
      options={{
        title: ticker,
        headerRight: data
          ? () => (
              <Pressable onPress={() => Share.share({ message: shareText(data) }).catch(() => {})} hitSlop={10}>
                <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>공유</Text>
              </Pressable>
            )
          : undefined,
      }}
    />
  );

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
  const earningsAt = data.fundamentals?.earningsAt;
  // Compare with the collection before this one, if there was one.
  const prev = report?.previous && report.previous.generatedAt !== data.generatedAt ? report.previous : null;
  const prevMove = prev ? ((q.price - prev.price) / prev.price) * 100 : 0;

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
        {earningsAt ? <Text style={[styles.earnings, { color: theme.accent }]}>{earningsText(earningsAt)}</Text> : null}
      </Card>

      {prev ? (
        <Card title={`지난 수집 대비 (${timeAgo(prev.generatedAt)})`}>
          <View style={styles.prevRow}>
            <Text style={{ color: theme.subtext }}>가격</Text>
            <Text style={{ color: theme.text }}>
              {usd(prev.price)} → {usd(q.price)} <Text style={{ color: dirColor(theme, prevMove) }}>({signedPct(prevMove)})</Text>
            </Text>
          </View>
          <View style={styles.prevRow}>
            <Text style={{ color: theme.subtext }}>전망</Text>
            <Text style={{ color: theme.text }}>
              <Text style={{ color: dirColor(theme, prev.direction) }}>{DIRECTION_LABEL[prev.direction]}</Text> →{' '}
              <Text style={{ color: dirColor(theme, data.outlook.direction), fontWeight: '700' }}>
                {DIRECTION_LABEL[data.outlook.direction]}
              </Text>
              {'  '}
              <Text style={{ color: theme.subtext }}>
                점수 {signed(prev.score, 0)} → {signed(data.outlook.score, 0)}
              </Text>
            </Text>
          </View>
        </Card>
      ) : null}

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
  earnings: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  prevRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
