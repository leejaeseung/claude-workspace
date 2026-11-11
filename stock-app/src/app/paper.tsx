import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PriceChart } from '@/components/PriceChart';
import { fetchPortfolio, startPortfolio, stopPortfolio } from '@/lib/api';
import { signedPct, timeAgo, usd } from '@/lib/format';
import { dirColor, useTheme, type Theme } from '@/lib/theme';
import type { PaperRules, PaperTrade, Portfolio } from '@/lib/types';

const POLL_MS = 60_000;
const PRESETS = [1_000, 10_000, 100_000];
const signedUsd = (x: number) => `${x >= 0 ? '+' : '-'}${usd(Math.abs(x))}`;
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function RulesText({ rules, theme }: { rules: PaperRules; theme: Theme }) {
  const lines = [
    `상승 전망 순위가 새로 계산될 때마다(약 12시간) 미국 장이 열려 있으면 매매해요.`,
    `순위 ${rules.buyRank}위 안, 점수 +${rules.buyScore} 이상인 종목을 최대 ${rules.maxPositions}개, 총액의 1/${rules.maxPositions}씩 사요.`,
    `점수가 ${rules.sellScore} 아래로 떨어지거나 순위가 ${rules.sellRank}위 밖으로 밀리면 팔아요.`,
    `보유 종목이 매입가 대비 ${rules.stopLoss}%가 되면 바로 손절하고, 판 종목은 ${rules.cooldownDays}일간 다시 사지 않아요.`,
    `매매마다 수수료 ${(rules.feeRate * 100).toFixed(2)}%를 떼고, 소수점 단위 주식으로 계산해요. 조건에 맞는 종목이 적으면 나머지는 현금으로 둬요.`,
  ];
  return (
    <View style={{ gap: 4 }}>
      {lines.map((l) => (
        <Text key={l} style={{ color: theme.subtext, fontSize: 12, lineHeight: 18 }}>
          · {l}
        </Text>
      ))}
    </View>
  );
}

function StartForm({ rules, theme, onStarted }: { rules: PaperRules; theme: Theme; onStarted: (p: Portfolio) => void }) {
  const [text, setText] = useState('10000');
  const [busy, setBusy] = useState(false);
  const amount = Number(text.replace(/[^\d.]/g, ''));

  const start = () => {
    setBusy(true);
    startPortfolio(amount)
      .then(onStarted)
      .catch((e) => Alert.alert('시작하지 못했어요', e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>가상 투자금</Text>
        <View style={[styles.inputRow, { backgroundColor: theme.input }]}>
          <Text style={{ color: theme.subtext, fontSize: 20, fontWeight: '700' }}>$</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="numeric"
            style={[styles.input, { color: theme.text }]}
            placeholder="10000"
            placeholderTextColor={theme.subtext}
            returnKeyType="done"
          />
        </View>
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Pressable key={p} onPress={() => setText(String(p))} style={[styles.preset, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 13 }}>{usd(p).replace('.00', '')}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={start}
          disabled={busy || !(amount > 0)}
          style={[styles.button, { backgroundColor: theme.accent, opacity: busy || !(amount > 0) ? 0.5 : 1 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>모의 투자 시작</Text>}
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>서버가 이렇게 투자해요</Text>
        <RulesText rules={rules} theme={theme} />
      </View>
    </View>
  );
}

function Stat({ label, value, color, theme }: { label: string; value: string; color?: string; theme: Theme }) {
  return (
    <View style={styles.stat}>
      <Text style={{ color: theme.subtext, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: color ?? theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function TradeRow({ t, theme, first }: { t: PaperTrade; theme: Theme; first: boolean }) {
  const buy = t.side === 'buy';
  return (
    <View style={[styles.trade, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.tradeHead}>
        <Text style={[styles.side, { color: buy ? theme.up : theme.down, backgroundColor: buy ? theme.upSoft : theme.downSoft }]}>
          {buy ? '매수' : '매도'}
        </Text>
        <Text style={{ color: theme.text, fontWeight: '700' }}>{t.ticker}</Text>
        <Text style={{ color: theme.subtext, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {t.shares}주 × {usd(t.price)}
        </Text>
        <Text style={{ color: theme.text, fontWeight: '600' }}>{usd(t.amount)}</Text>
      </View>
      <View style={styles.tradeHead}>
        <Text style={{ color: theme.subtext, fontSize: 12, flex: 1 }} numberOfLines={2}>
          {fmtWhen(t.at)} · {t.reason}
        </Text>
        {t.pnl != null ? (
          <Text style={{ color: dirColor(theme, t.pnl), fontSize: 12, fontWeight: '700' }}>{signedUsd(t.pnl)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PortfolioView({ p, theme, onReset }: { p: Portfolio; theme: Theme; onReset: () => void }) {
  const [allTrades, setAllTrades] = useState(false);
  const positions = p.positions ?? [];
  const trades = p.trades ?? [];
  const shown = allTrades ? trades : trades.slice(0, 10);
  const chart = (p.history ?? []).map((h) => ({ t: h.t, c: h.value }));
  const beat = p.benchmarkPercent != null ? p.pnlPercent! - p.benchmarkPercent : null;

  let status: string;
  if (p.marketOpen) status = `장 중 · ${timeAgo(p.markedAt ?? null)} 평가`;
  else if (!p.lastRebalanceAt) status = '장이 열리면 첫 매수를 해요 (미국 정규장, 한국 시간 밤 11:30~새벽 6시·서머타임 밤 10:30~새벽 5시)';
  else status = `장 마감 · ${p.markedAt ? `${timeAgo(p.markedAt)} 평가` : ''}`;

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={{ color: theme.subtext, fontSize: 13 }}>총 평가금액</Text>
        <Text style={{ color: theme.text, fontSize: 30, fontWeight: '800', marginTop: 2 }}>{usd(p.value!)}</Text>
        <Text style={{ color: dirColor(theme, p.pnl!), fontSize: 15, fontWeight: '700', marginTop: 2 }}>
          {signedUsd(p.pnl!)} ({signedPct(p.pnlPercent)})
        </Text>
        <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 6 }}>{status}</Text>
        <View style={styles.stats}>
          <Stat label="투자 원금" value={usd(p.initial!)} theme={theme} />
          <Stat label="현금" value={usd(p.cash!)} theme={theme} />
          <Stat label="실현 손익" value={signedUsd(p.realizedPnl!)} color={dirColor(theme, p.realizedPnl!)} theme={theme} />
          <Stat label="낸 수수료" value={usd(p.fees!)} theme={theme} />
          <Stat
            label="같은 기간 S&P 500(SPY)"
            value={signedPct(p.benchmarkPercent)}
            color={p.benchmarkPercent != null ? dirColor(theme, p.benchmarkPercent) : undefined}
            theme={theme}
          />
          <Stat
            label="SPY 대비"
            value={beat != null ? `${beat >= 0 ? '+' : ''}${beat.toFixed(2)}%p` : '-'}
            color={beat != null ? dirColor(theme, beat) : undefined}
            theme={theme}
          />
        </View>
        <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 8 }}>{fmtWhen(p.startedAt!)} 시작</Text>
      </View>

      {chart.length > 1 ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>평가금액 추이</Text>
          <PriceChart points={chart} hint="눌러서 시점별 평가금액 보기" withTime />
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>보유 종목 {positions.length}개</Text>
        {positions.length === 0 ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>
            {p.lastRebalanceAt ? '지금은 조건에 맞는 종목이 없어 현금으로 갖고 있어요.' : '아직 산 종목이 없어요.'}
          </Text>
        ) : (
          positions.map((x, i) => (
            <Pressable
              key={x.ticker}
              onPress={() => router.push({ pathname: '/stock/[ticker]', params: { ticker: x.ticker } })}
              style={({ pressed }) => [
                styles.position,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { opacity: 0.6 },
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                  {x.ticker}{' '}
                  <Text style={{ color: theme.subtext, fontWeight: '400', fontSize: 12 }} numberOfLines={1}>
                    {x.name}
                  </Text>
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
                  {x.shares}주 · 평단 {usd(x.avgCost)} → {usd(x.price)}
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>
                  비중 {x.weight}%{x.rank != null ? ` · 현재 ${x.rank}위` : ''}
                  {x.score != null ? ` · 점수 ${x.score > 0 ? '+' : ''}${x.score}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{usd(x.value)}</Text>
                <Text style={{ color: dirColor(theme, x.pnl), fontSize: 12, fontWeight: '600' }}>
                  {signedUsd(x.pnl)} ({signedPct(x.pnlPercent)})
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>매매 기록</Text>
        {trades.length === 0 ? (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>아직 매매가 없어요.</Text>
        ) : (
          shown.map((t, i) => <TradeRow key={`${t.at}-${t.ticker}-${t.side}`} t={t} theme={theme} first={i === 0} />)
        )}
        {trades.length > shown.length ? (
          <Pressable onPress={() => setAllTrades(true)} hitSlop={8} style={{ marginTop: 8 }}>
            <Text style={{ color: theme.accent, fontWeight: '600', textAlign: 'center' }}>전체 {trades.length}건 보기</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>투자 규칙</Text>
        <RulesText rules={p.rules} theme={theme} />
      </View>

      <Pressable onPress={onReset} hitSlop={8} style={{ alignSelf: 'center', padding: 8 }}>
        <Text style={{ color: theme.down, fontWeight: '600' }}>모의 투자 끝내기</Text>
      </Pressable>
      <Text style={[styles.note, { color: theme.subtext }]}>
        실제 돈이 오가지 않는 가상 투자예요. 규칙 기반 점수로 매매한 결과일 뿐이며 투자 권유나 수익을 보장하지 않습니다.
      </Text>
    </View>
  );
}

export default function PaperScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      fetchPortfolio()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e))),
    [],
  );

  // The server trades on its own schedule; poll while the screen is open.
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, POLL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const pull = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const reset = () =>
    Alert.alert('모의 투자 끝내기', '보유 종목과 매매 기록이 모두 지워져요. 끝낼까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '끝내기',
        style: 'destructive',
        onPress: () =>
          stopPortfolio()
            .then(load)
            .catch((e) => Alert.alert('실패', e instanceof Error ? e.message : String(e))),
      },
    ]);

  if (!data) {
    return (
      <View style={styles.center}>
        {error ? <Text style={{ color: theme.down, textAlign: 'center' }}>{error}</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={theme.accent} />}>
        {error ? <Text style={{ color: theme.down, fontSize: 12 }}>{error}</Text> : null}
        {data.status === 'active' ? (
          <PortfolioView p={data} theme={theme} onReset={reset} />
        ) : (
          <>
            <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 19 }}>
              금액을 정하면 서버가 상승 전망 순위를 보고 알아서 가상으로 사고팔아요. 앱을 닫아도 서버에서 계속 운용되고, 여기서 결과를 확인할 수
              있어요.
            </Text>
            <StartForm rules={data.rules} theme={theme} onStarted={setData} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 14, gap: 6 },
  input: { flex: 1, fontSize: 22, fontWeight: '700', paddingVertical: 10 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 10 },
  preset: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  button: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 10 },
  stat: { width: '50%' },
  position: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  trade: { paddingVertical: 8, gap: 3 },
  tradeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { fontSize: 11, fontWeight: '700', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  note: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
