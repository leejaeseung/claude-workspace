import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchTickers } from '@/lib/api';
import { useRecent } from '@/lib/recent';
import { useTheme } from '@/lib/theme';
import type { SearchResult } from '@/lib/types';

const POPULAR = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ'];

function openTicker(ticker: string) {
  router.push({ pathname: '/stock/[ticker]', params: { ticker: ticker.trim().toUpperCase() } });
}

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const recent = useRecent();
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

  const submit = () => {
    const q = trimmed;
    if (!q) return;
    // Prefer an exact ticker match; otherwise take the top search hit; otherwise try the raw text as a ticker.
    const exact = results.find((r) => r.ticker === q.toUpperCase());
    openTicker(exact?.ticker ?? results[0]?.ticker ?? q);
  };

  const chip = (ticker: string, onPress: () => void, onLongPress?: () => void) => (
    <Pressable
      key={ticker}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.chipText, { color: theme.text }]}>{ticker}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
      <Text style={[styles.lead, { color: theme.subtext }]}>
        미국 주식 티커나 회사 이름을 입력하면 최신 시세·뉴스·재무 지표를 모아 요약하고 주가 방향성을 알려드려요.
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
        <Pressable onPress={submit} style={[styles.go, { backgroundColor: theme.accent }]} accessibilityLabel="분석하기">
          <Text style={styles.goText}>분석</Text>
        </Pressable>
      </View>

      {results.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {results.map((r, i) => (
            <Pressable
              key={r.ticker}
              onPress={() => openTicker(r.ticker)}
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

      {recent.items.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: theme.text }]}>최근 본 종목</Text>
            <Pressable onPress={recent.clear} hitSlop={8}>
              <Text style={{ color: theme.accent }}>모두 지우기</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {recent.items.map((r) => chip(r.ticker, () => openTicker(r.ticker), () => recent.remove(r.ticker)))}
          </View>
          <Text style={[styles.hint, { color: theme.subtext }]}>길게 누르면 목록에서 지워요.</Text>
        </>
      )}

      <Text style={[styles.section, { color: theme.text }]}>인기 종목</Text>
      <View style={styles.chips}>{POPULAR.map((t) => chip(t, () => openTicker(t)))}</View>
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
  section: { fontSize: 17, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 8 },
});
