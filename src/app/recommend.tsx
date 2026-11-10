import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchRecommendations, rescanRecommendations } from '@/lib/api';
import { CONFIDENCE_LABEL, DIRECTION_LABEL, signedPct, timeAgo, usd } from '@/lib/format';
import { POLL_MS } from '@/lib/reports';
import { dirColor, dirSoft, useTheme, type Theme } from '@/lib/theme';
import type { Recommendation, Recommendations } from '@/lib/types';

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function Row({ r, rank, theme }: { r: Recommendation; rank: number; theme: Theme }) {
  const color = dirColor(theme, r.direction);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/stock/[ticker]', params: { ticker: r.ticker } })}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.head}>
        <Text style={[styles.rank, { color: rank <= 3 ? theme.up : theme.subtext }]}>{rank}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>
            {r.ticker}{' '}
            <Text style={{ color: theme.subtext, fontWeight: '400', fontSize: 13 }} numberOfLines={1}>
              {r.name}
            </Text>
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
            {usd(r.price)} <Text style={{ color: dirColor(theme, r.changePercent) }}>{signedPct(r.changePercent)}</Text>
            {r.sector ? ` · ${r.sector}` : ''}
          </Text>
        </View>
        <View style={[styles.score, { backgroundColor: dirSoft(theme, r.direction) }]}>
          <Text style={{ color, fontWeight: '800', fontSize: 18 }}>{sign(r.score)}</Text>
          <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{DIRECTION_LABEL[r.direction]}</Text>
        </View>
      </View>

      <Text style={{ color: theme.text, fontSize: 13, marginTop: 8 }}>{r.headline}</Text>
      <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4 }}>
        단기 {sign(r.shortScore)} · 중기 {sign(r.midScore)} · 신뢰도 {CONFIDENCE_LABEL[r.confidence]}
        {r.targetUpside != null ? ` · 목표가 여력 ${signedPct(r.targetUpside, 1)}` : ''}
      </Text>

      {r.reasons.length ? (
        <View style={styles.tags}>
          {r.reasons.map((t) => (
            <Text key={t} style={[styles.tag, { color: theme.up, backgroundColor: theme.upSoft }]}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
      {r.risks.length ? (
        <View style={styles.tags}>
          {r.risks.map((t) => (
            <Text key={t} style={[styles.tag, { color: theme.down, backgroundColor: theme.downSoft }]}>
              {t}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function RecommendScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Recommendations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      fetchRecommendations()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e))),
    [],
  );

  // Refetch on focus, and keep polling while the server is still scanning.
  const scanning = data?.status === 'scanning';
  useFocusEffect(
    useCallback(() => {
      load();
      if (!scanning) return;
      const id = setInterval(load, POLL_MS);
      return () => clearInterval(id);
    }, [load, scanning]),
  );

  const rescan = () =>
    Alert.alert('다시 계산', '60여 개 종목을 새로 분석해요. 몇 분 걸리고, 그동안은 이전 순위를 보여 드려요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '시작',
        onPress: () =>
          rescanRecommendations()
            .then(setData)
            .catch((e) => setError(e instanceof Error ? e.message : String(e))),
      },
    ]);

  const pull = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const progress = data?.progress;
  const progressText = progress ? `종목을 분석하는 중이에요 (${progress.done}/${progress.total})` : null;

  if (!data || data.items.length === 0) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={{ color: theme.down, textAlign: 'center' }}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.centerText, { color: theme.subtext }]}>
              {progressText ?? '불러오는 중이에요'}
              {'\n'}처음 계산은 몇 분 걸려요. 화면을 나가도 서버에서 계속 진행돼요.
            </Text>
          </>
        )}
        {data && !scanning ? (
          <Pressable onPress={rescan} style={[styles.button, { backgroundColor: theme.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>계산 시작</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={theme.accent} />}>
      <Text style={[styles.lead, { color: theme.subtext }]}>
        미국 대형주와 분석 목록의 종목 {data.scanned}개를 같은 규칙으로 분석해 방향성 점수(-100~+100)가 높은 순으로 골랐어요.
        눌러서 자세한 분석을 볼 수 있어요.
      </Text>
      <View style={styles.meta}>
        {scanning ? (
          <View style={styles.scanning}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={{ color: theme.accent, fontSize: 12 }}>{progressText}</Text>
          </View>
        ) : (
          <Text style={{ color: theme.subtext, fontSize: 12 }}>{data.scannedAt ? `${timeAgo(data.scannedAt)} 계산` : ''}</Text>
        )}
        {!scanning ? (
          <Pressable onPress={rescan} hitSlop={8}>
            <Text style={{ color: theme.accent, fontWeight: '600' }}>다시 계산</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: theme.down, fontSize: 12 }}>{error}</Text> : null}

      {data.items.map((r, i) => (
        <Row key={r.ticker} r={r} rank={i + 1} theme={theme} />
      ))}

      <Text style={[styles.note, { color: theme.subtext }]}>
        {data.failed.length ? `분석하지 못한 종목: ${data.failed.join(', ')}\n` : ''}
        순위는 공개 데이터와 기술적 지표·뉴스 헤드라인을 규칙에 따라 점수화한 참고 자료이며, 투자 권유나 수익을 보장하지 않습니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { marginTop: 14, textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  lead: { fontSize: 13, lineHeight: 19 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { borderRadius: 12, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 22, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  score: { alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 56 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: { fontSize: 11, fontWeight: '600', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  note: { fontSize: 11, lineHeight: 16, marginTop: 6 },
});
