import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { compact, signedPct, timeAgo, usd } from '@/lib/format';
import { dirColor, useTheme, type Theme } from '@/lib/theme';
import type { Analysis, MetricEval, MetricRating, NewsItem, Signal } from '@/lib/types';

export function SummaryCard({ lines }: { lines: string[] }) {
  const theme = useTheme();
  return (
    <Card title="핵심 요약">
      {lines.map((l, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>{l}</Text>
        </View>
      ))}
    </Card>
  );
}

function SignalRow({ s }: { s: Signal }) {
  const theme = useTheme();
  const color = dirColor(theme, Math.abs(s.effect) < 0.1 ? 0 : s.effect);
  const tag = s.effect >= 0.1 ? '긍정' : s.effect <= -0.1 ? '부정' : '중립';
  return (
    <View style={[styles.signal, { borderTopColor: theme.border }]}>
      <View style={styles.signalHead}>
        <Text style={[styles.signalLabel, { color: theme.text }]}>
          {s.label}
          <Text style={{ color: theme.subtext, fontWeight: '400' }}> · {s.horizon === 'short' ? '단기' : '중기'}</Text>
        </Text>
        <Text style={{ color, fontWeight: '700' }}>{tag}</Text>
      </View>
      <Text style={{ color: theme.text, marginTop: 2 }}>{s.value}</Text>
      <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{s.reason}</Text>
    </View>
  );
}

export function SignalsCard({ signals }: { signals: Signal[] }) {
  const theme = useTheme();
  const [all, setAll] = useState(false);
  const shown = all ? signals : signals.slice(0, 5);
  return (
    <Card
      title="판단 근거"
      right={
        signals.length > 5 ? (
          <Pressable onPress={() => setAll((v) => !v)} hitSlop={8}>
            <Text style={{ color: theme.accent }}>{all ? '접기' : `전체 ${signals.length}개`}</Text>
          </Pressable>
        ) : null
      }>
      <Text style={{ color: theme.subtext, fontSize: 12, marginBottom: 4 }}>영향이 큰 순서입니다.</Text>
      {shown.map((s) => (
        <SignalRow key={s.key} s={s} />
      ))}
    </Card>
  );
}

const RATING_LABEL = { good: '좋음', neutral: '보통', bad: '나쁨' } as const;
type RatingFilter = 'all' | MetricRating;

function ratingColors(theme: Theme, r: MetricRating) {
  if (r === 'good') return { fg: theme.good, bg: theme.goodSoft };
  if (r === 'bad') return { fg: theme.bad, bg: theme.badSoft };
  return { fg: theme.neutral, bg: theme.neutralSoft };
}

function MetricRow({ m, first }: { m: MetricEval; first: boolean }) {
  const theme = useTheme();
  const c = ratingColors(theme, m.rating);
  return (
    <View style={[styles.metric, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.metricHead}>
        <Text style={{ color: theme.text, fontWeight: '600', flexShrink: 1 }}>{m.label}</Text>
        <Text style={{ color: theme.text, flex: 1, textAlign: 'right' }} numberOfLines={1}>
          {m.value}
        </Text>
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
          <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{RATING_LABEL[m.rating]}</Text>
        </View>
      </View>
      <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 18, marginTop: 3 }}>{m.comment}</Text>
    </View>
  );
}

/** Each key metric with a good/neutral/bad verdict, grouped by theme. */
export function MetricsCard({ a, metrics }: { a: Analysis; metrics: MetricEval[] }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<RatingFilter>('all');
  const f = a.fundamentals;
  const q = a.quote;
  const count = (r: MetricRating) => metrics.filter((m) => m.rating === r).length;
  const tabs: [RatingFilter, string][] = [
    ['all', `전체 ${metrics.length}`],
    ['good', `좋음 ${count('good')}`],
    ['neutral', `보통 ${count('neutral')}`],
    ['bad', `나쁨 ${count('bad')}`],
  ];
  const shown = metrics.filter((m) => filter === 'all' || m.rating === filter);
  const groups = [...new Set(shown.map((m) => m.group))];
  const info = [
    [f?.sector, f?.industry].filter(Boolean).join(' · '),
    f?.marketCap ? `시가총액 ${f.marketCap}` : '',
    q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `52주 ${usd(q.fiftyTwoWeekLow)} ~ ${usd(q.fiftyTwoWeekHigh)}` : '',
  ].filter(Boolean);

  return (
    <Card title="주요 지표 평가">
      {info.length ? <Text style={{ color: theme.subtext, marginBottom: 10, lineHeight: 19 }}>{info.join('\n')}</Text> : null}
      <View style={styles.tabs}>
        {tabs.map(([k, label]) => {
          const on = filter === k;
          const c = k === 'all' ? { fg: theme.accent } : ratingColors(theme, k);
          return (
            <Pressable key={k} onPress={() => setFilter(k)} style={[styles.tab, { backgroundColor: on ? c.fg : theme.input }]}>
              <Text style={{ color: on ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {groups.map((g) => (
        <View key={g} style={{ marginTop: 6 }}>
          <Text style={[styles.groupTitle, { color: theme.subtext }]}>{g}</Text>
          {shown
            .filter((m) => m.group === g)
            .map((m, i) => (
              <MetricRow key={m.key} m={m} first={i === 0} />
            ))}
        </View>
      ))}
      {shown.length === 0 && <Text style={{ color: theme.subtext, paddingVertical: 12 }}>해당하는 지표가 없습니다.</Text>}
      <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
        미국 주식 전반에 쓰는 일반적인 기준으로 평가했어요. 업종마다 적정 수준이 다르니 참고용으로 보세요.
      </Text>
    </Card>
  );
}

export function StatsCard({ a }: { a: Analysis }) {
  const theme = useTheme();
  const t = a.technicals;
  const f = a.fundamentals;
  const q = a.quote;
  const rows: [string, string][] = [
    ['시가총액', f?.marketCap ?? '-'],
    ['거래량', `${compact(q.volume)}${t.volumeRatio ? ` (평균 ${t.volumeRatio.toFixed(1)}배)` : ''}`],
    ['52주 최고', q.fiftyTwoWeekHigh != null ? usd(q.fiftyTwoWeekHigh) : '-'],
    ['52주 최저', q.fiftyTwoWeekLow != null ? usd(q.fiftyTwoWeekLow) : '-'],
    ['P/E', f?.pe ?? '-'],
    ['선행 P/E', f?.forwardPe ?? '-'],
    ['PEG', f?.peg ?? '-'],
    ['P/S', f?.ps ?? '-'],
    ['EPS (TTM)', f?.epsTtm ?? '-'],
    ['내년 EPS 성장', f?.epsNextY ?? '-'],
    ['매출 성장 (YoY 분기)', f?.salesQoQ ?? '-'],
    ['순이익률', f?.profitMargin ?? '-'],
    ['ROE', f?.roe ?? '-'],
    ['부채비율 (D/E)', f?.debtEq ?? '-'],
    ['배당', f?.dividend ?? '-'],
    ['베타', f?.beta ?? '-'],
    ['공매도 비율', f?.shortFloat ?? '-'],
    ['RSI (14)', t.rsi14 != null ? t.rsi14.toFixed(1) : '-'],
    ['20일선', t.sma20 != null ? usd(t.sma20) : '-'],
    ['50일선', t.sma50 != null ? usd(t.sma50) : '-'],
    ['200일선', t.sma200 != null ? usd(t.sma200) : '-'],
    ['변동성 (연환산)', t.volatility != null ? `${t.volatility.toFixed(0)}%` : '-'],
  ];
  const header = [f?.sector, f?.industry].filter(Boolean).join(' · ');
  return (
    <Card title="주요 지표">
      {header ? <Text style={{ color: theme.subtext, marginBottom: 8 }}>{header}</Text> : null}
      <View style={styles.grid}>
        {rows.map(([k, v]) => (
          <View key={k} style={[styles.cell, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.subtext, fontSize: 12 }}>{k}</Text>
            <Text style={{ color: theme.text, fontWeight: '600', marginTop: 2 }}>{v}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function ReturnsRow({ a }: { a: Analysis }) {
  const theme = useTheme();
  const t = a.technicals;
  const items: [string, number | null][] = [
    ['1주', t.return1w],
    ['1개월', t.return1m],
    ['3개월', t.return3m],
    ['6개월', t.return6m],
    ['1년', t.return1y],
  ];
  return (
    <View style={styles.returns}>
      {items.map(([k, v]) => (
        <View key={k} style={styles.returnCell}>
          <Text style={{ color: theme.subtext, fontSize: 11 }}>{k}</Text>
          <Text style={{ color: v == null ? theme.subtext : dirColor(theme, v), fontWeight: '700', fontSize: 13 }}>
            {signedPct(v, 1)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function NewsRow({ n }: { n: NewsItem }) {
  const theme = useTheme();
  const dot = n.sentimentLabel === 'positive' ? theme.up : n.sentimentLabel === 'negative' ? theme.down : theme.neutral;
  return (
    <Pressable
      onPress={() => Linking.openURL(n.url)}
      style={({ pressed }) => [styles.news, { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, lineHeight: 20 }}>{n.titleKo || n.title}</Text>
        {n.titleKo ? (
          <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
            {n.title}
          </Text>
        ) : null}
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
          {n.source}
          {n.publishedAt ? ` · ${timeAgo(n.publishedAt)}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

type NewsFilter = 'all' | 'positive' | 'negative';

export function NewsCard({ a }: { a: Analysis }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [limit, setLimit] = useState(10);
  const list = a.news.filter((n) => filter === 'all' || n.sentimentLabel === filter);
  const s = a.newsSentiment;
  const tabs: [NewsFilter, string][] = [
    ['all', `전체 ${a.news.length}`],
    ['positive', `긍정 ${s.positive}`],
    ['negative', `부정 ${s.negative}`],
  ];
  return (
    <Card title="최신 뉴스">
      <View style={styles.tabs}>
        {tabs.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => {
              setFilter(k);
              setLimit(10);
            }}
            style={[styles.tab, { backgroundColor: filter === k ? theme.accent : theme.input }]}>
            <Text style={{ color: filter === k ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: theme.subtext, fontSize: 12, marginBottom: 4 }}>
        제목은 자동 번역했고 분위기는 영어 원문 단어로 분류했어요. 누르면 원문 기사가 열립니다.
      </Text>
      {list.slice(0, limit).map((n, i) => (
        <NewsRow key={`${i}-${n.url}`} n={n} />
      ))}
      {list.length === 0 && <Text style={{ color: theme.subtext, paddingVertical: 12 }}>해당하는 뉴스가 없습니다.</Text>}
      {list.length > limit && (
        <Pressable onPress={() => setLimit((l) => l + 10)} style={styles.more}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>더 보기</Text>
        </Pressable>
      )}
    </Card>
  );
}

export function SourcesFooter({ a }: { a: Analysis }) {
  const theme = useTheme();
  const failed = a.sources.filter((s) => !s.ok);
  return (
    <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
      <Text style={[styles.foot, { color: theme.subtext }]}>
        출처: {a.sources.map((s) => `${s.name}${s.ok ? '' : ' (실패)'}`).join(', ')}
      </Text>
      {failed.length > 0 && (
        <Text style={[styles.foot, { color: theme.subtext }]}>
          일부 출처에서 데이터를 가져오지 못해 그 항목은 분석에서 빠졌습니다.
        </Text>
      )}
      <Text style={[styles.foot, { color: theme.subtext }]}>
        분석 시각: {new Date(a.generatedAt).toLocaleString('ko-KR')} · 시세 기준: {new Date(a.quote.marketTime).toLocaleString('ko-KR')}
      </Text>
      <Text style={[styles.foot, { color: theme.subtext, marginTop: 8 }]}>{a.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bulletRow: { flexDirection: 'row', marginBottom: 8 },
  bullet: { width: 16, fontSize: 15, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22 },
  signal: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  signalHead: { flexDirection: 'row', justifyContent: 'space-between' },
  signalLabel: { fontWeight: '600', flex: 1, marginRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 8, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  returns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  returnCell: { alignItems: 'center', flex: 1 },
  news: { flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  more: { alignItems: 'center', paddingTop: 10 },
  metric: { paddingVertical: 10 },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  groupTitle: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  foot: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
