import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchPortfolio, searchTickers } from '@/lib/api';
import { DIRECTION_LABEL, earningsBadge, signedPct, timeAgo, usd } from '@/lib/format';
import {
  isPending,
  refreshReports,
  removeReport,
  SORT_LABEL,
  sortReports,
  startAllReports,
  startReport,
  useReports,
  type SortKey,
} from '@/lib/reports';
import { dirColor, useTheme, type Theme } from '@/lib/theme';
import type { Portfolio, ReportSummary, SearchResult } from '@/lib/types';

const POPULAR = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ'];

function openTicker(ticker: string) {
  router.push({ pathname: '/stock/[ticker]', params: { ticker } });
}

const STATUS_LABEL = { queued: '대기 중', running: '수집 중', done: '완료', error: '실패' } as const;

function ReportRow({ r, theme, first }: { r: ReportSummary; theme: Theme; first: boolean }) {
  const pending = isPending(r.status);
  const hasData = r.generatedAt != null;
  const onPress = () => {
    if (hasData) return openTicker(r.ticker);
    if (r.status === 'error') startReport(r.ticker).catch((e) => Alert.alert('요청 실패', String(e?.message ?? e)));
  };
  const onLongPress = () =>
    Alert.alert(r.ticker, '목록에서 지울까요?', [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: () => removeReport(r.ticker) },
    ]);
  const statusColor = r.status === 'error' ? theme.down : pending ? theme.accent : theme.subtext;
  let sub: string;
  if (pending) sub = hasData ? `새로 수집 중 · 이전 자료 ${timeAgo(r.generatedAt)}` : '자료를 수집하고 있어요';
  else if (r.status === 'error') sub = hasData ? `${r.error} · 이전 자료 보기` : `${r.error} · 눌러서 다시 요청`;
  else sub = `${timeAgo(r.generatedAt)} 수집`;
  const earnings = earningsBadge(r.earningsAt);
  // The outlook flipped since the collection before this one.
  const flipped = r.previous && r.direction && r.previous.direction !== r.direction ? r.previous.direction : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!hasData && pending}
      style={({ pressed }) => [
        styles.result,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowHead}>
          <Text style={[styles.resultTicker, { color: theme.text, width: undefined }]}>{r.ticker}</Text>
          {r.name ? (
            <Text style={{ color: theme.subtext, flex: 1 }} numberOfLines={1}>
              {r.name}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
        {earnings || flipped ? (
          <View style={styles.tags}>
            {earnings ? (
              <Text style={[styles.tag, { color: theme.accent, borderColor: theme.accent }]}>{earnings}</Text>
            ) : null}
            {flipped && r.direction ? (
              <Text style={[styles.tag, { color: dirColor(theme, r.direction), borderColor: dirColor(theme, r.direction) }]}>
                전망 {DIRECTION_LABEL[flipped]} → {DIRECTION_LABEL[r.direction]}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={{ color: r.status === 'error' ? theme.down : theme.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {r.price != null ? (
          <>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{usd(r.price)}</Text>
            <Text style={{ color: dirColor(theme, r.changePercent ?? 0), fontSize: 12 }}>
              {signedPct(r.changePercent)}
              {r.direction ? <Text style={{ color: dirColor(theme, r.direction) }}> · 전망 {DIRECTION_LABEL[r.direction]}</Text> : null}
            </Text>
          </>
        ) : null}
        {pending || r.status === 'error' || r.price == null ? (
          <View style={styles.status}>
            {pending ? <ActivityIndicator size="small" color={theme.accent} style={{ transform: [{ scale: 0.7 }] }} /> : null}
            <Text style={{ color: statusColor, fontSize: 12, fontWeight: '600' }}>{STATUS_LABEL[r.status]}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { reports, loaded, error: listError } = useReports();
  const [sort, setSort] = useState<SortKey>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const sorted = sortReports(reports, sort);
  const [paper, setPaper] = useState<Portfolio | null>(null);

  // The paper card shows the running result; refresh it whenever home comes back into view.
  useFocusEffect(
    useCallback(() => {
      fetchPortfolio()
        .then(setPaper)
        .catch(() => {});
    }, []),
  );

  // Remember the chosen sort order between launches.
  useEffect(() => {
    AsyncStorage.getItem('reportSort')
      .then((v) => v && v in SORT_LABEL && setSort(v as SortKey))
      .catch(() => {});
  }, []);
  const changeSort = (k: SortKey) => {
    setSort(k);
    AsyncStorage.setItem('reportSort', k).catch(() => {});
  };

  const pullRefresh = () => {
    setRefreshing(true);
    refreshReports().finally(() => setRefreshing(false));
  };

  const recollectAll = () =>
    Alert.alert('전체 새로 수집', `목록의 ${reports.length}개 종목을 모두 새로 수집할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '수집',
        onPress: () =>
          startAllReports()
            .then((n) => setNotice({ text: n ? `${n}개 종목을 새로 수집하고 있어요.` : '이미 모두 수집 중이에요.' }))
            .catch((e) => setNotice({ text: e instanceof Error ? e.message : String(e), error: true })),
      },
    ]);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [query, setQuery] = useState('');
  // Results are tagged with the query they answer, so stale ones are simply ignored.
  const [hits, setHits] = useState<{ q: string; results: SearchResult[] }>({ q: '', results: [] });
  const trimmed = query.trim();
  const results = hits.q === trimmed ? hits.results : [];
  const searching = trimmed.length > 0 && hits.q !== trimmed;

  useEffect(() => {
    if (!trimmed) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchTickers(trimmed, ctrl.signal)
        .then((r) => setHits({ q: trimmed, results: r }))
        .catch(() => !ctrl.signal.aborted && setHits({ q: trimmed, results: [] }));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed]);

  const request = (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    setQuery('');
    startReport(t)
      .then(() => setNotice({ text: `${t} 자료 수집을 시작했어요. 끝나면 아래 목록에서 확인할 수 있어요.` }))
      .catch((e) => setNotice({ text: e instanceof Error ? e.message : String(e), error: true }));
  };

  const submit = () => {
    const q = trimmed;
    if (!q) return;
    // Prefer an exact ticker match; otherwise take the top search hit; otherwise try the raw text as a ticker.
    const exact = results.find((r) => r.ticker === q.toUpperCase());
    request(exact?.ticker ?? results[0]?.ticker ?? q);
  };

  const chip = (ticker: string, onPress: () => void) => (
    <Pressable
      key={ticker}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.chipText, { color: theme.text }]}>{ticker}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullRefresh} tintColor={theme.accent} />}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <Text style={[styles.lead, { color: theme.subtext }]}>
        미국 주식 티커나 회사 이름으로 분석을 요청하면 서버가 시세·뉴스·재무 지표를 모아 요약하고 주가 방향성을 알려드려요.
      </Text>

      <View style={[styles.searchRow, { backgroundColor: theme.input }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="예: AAPL, Nvidia, Tesla"
          placeholderTextColor={theme.subtext}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.search, { color: theme.text }]}
        />
        {searching ? <ActivityIndicator color={theme.accent} style={{ marginRight: 12 }} /> : null}
        <Pressable onPress={submit} style={[styles.go, { backgroundColor: theme.accent }]} accessibilityLabel="분석 요청">
          <Text style={styles.goText}>요청</Text>
        </Pressable>
      </View>

      {results.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {results.map((r, i) => (
            <Pressable
              key={r.ticker}
              onPress={() => request(r.ticker)}
              style={({ pressed }) => [
                styles.result,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { opacity: 0.6 },
              ]}>
              <Text style={[styles.resultTicker, { color: theme.text }]}>{r.ticker}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text }} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12 }}>
                  {r.exchange} · {r.type === 'ETF' ? 'ETF' : '주식'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {notice ? (
        <Text style={[styles.notice, { color: notice.error ? theme.down : theme.subtext }]}>{notice.text}</Text>
      ) : null}

      <Pressable
        onPress={() => router.push('/recommend')}
        style={({ pressed }) => [styles.reco, { backgroundColor: theme.upSoft, opacity: pressed ? 0.7 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.up, fontWeight: '800', fontSize: 16 }}>▲ 상승 전망 TOP 10</Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>미국 대형주 60여 개 중 방향성 점수가 높은 종목</Text>
        </View>
        <Text style={{ color: theme.up, fontSize: 20, fontWeight: '700' }}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/paper')}
        style={({ pressed }) => [styles.reco, { marginTop: 8, backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>모의 투자</Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
            {paper?.status === 'active'
              ? `보유 ${paper.positions?.length ?? 0}종목 · 원금 ${usd(paper.initial!)}`
              : '금액을 정하면 서버가 전망 좋은 종목에 가상으로 투자해요'}
          </Text>
        </View>
        {paper?.status === 'active' ? (
          <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{usd(paper.value!)}</Text>
            <Text style={{ color: dirColor(theme, paper.pnl!), fontSize: 12, fontWeight: '600' }}>{signedPct(paper.pnlPercent)}</Text>
          </View>
        ) : null}
        <Text style={{ color: theme.subtext, fontSize: 20, fontWeight: '700' }}>›</Text>
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={[styles.section, { color: theme.text }]}>분석 목록</Text>
        {reports.length > 0 ? (
          <Pressable onPress={recollectAll} disabled={reports.every((r) => isPending(r.status))} hitSlop={8}>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>전체 새로 수집</Text>
          </Pressable>
        ) : null}
      </View>
      {reports.length > 1 ? (
        <View style={styles.sorts}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => changeSort(k)}
              style={[styles.sort, { backgroundColor: sort === k ? theme.accent : theme.input }]}>
              <Text style={{ color: sort === k ? '#fff' : theme.subtext, fontSize: 12, fontWeight: '600' }}>{SORT_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {listError ? (
        <Text style={[styles.hint, { color: theme.down, marginTop: 0 }]}>{listError}</Text>
      ) : !loaded ? (
        <ActivityIndicator color={theme.accent} />
      ) : reports.length === 0 ? (
        <Text style={[styles.hint, { color: theme.subtext, marginTop: 0 }]}>
          종목을 검색해 분석을 요청하면 서버가 백그라운드에서 자료를 모아요. 앱을 닫았다가 나중에 다시 와서 확인해도 돼요.
        </Text>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: theme.card, marginTop: 0 }]}>
            {sorted.map((r, i) => (
              <ReportRow key={r.ticker} r={r} theme={theme} first={i === 0} />
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.subtext }]}>
            길게 누르면 목록에서 지워요. 화면을 당기면 상태를 새로 불러오고, 서버가 오래된 자료는 주기적으로 다시 수집해요.
          </Text>
        </>
      )}

      <Text style={[styles.section, { color: theme.text }]}>인기 종목</Text>
      <View style={styles.chips}>{POPULAR.map((t) => chip(t, () => request(t)))}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 14 },
  search: { flex: 1, fontSize: 17, paddingVertical: 12 },
  go: { paddingHorizontal: 18, paddingVertical: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  goText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  resultTicker: { width: 64, fontWeight: '700', fontSize: 15 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  reco: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 16 },
  sorts: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  sort: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { fontSize: 11, fontWeight: '600', borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingHorizontal: 4, overflow: 'hidden' },
  section: { fontSize: 17, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  notice: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
});
