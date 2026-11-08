import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { usd } from '@/lib/format';
import { dirColor, useTheme } from '@/lib/theme';
import type { PricePoint } from '@/lib/types';

const HEIGHT = 160;
const PAD = 6;
const DAY = 86_400;

const PERIODS = [
  { key: '1M', label: '1개월', days: 31 },
  { key: '3M', label: '3개월', days: 92 },
  { key: '6M', label: '6개월', days: 183 },
  { key: '1Y', label: '1년', days: 366 },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' });

export function PriceChart({ points: all }: { points: PricePoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>('6M');
  const [touch, setTouch] = useState<number | null>(null); // index into `points`

  // Older reports only hold ~6 months, so periods longer than the data are hidden.
  const span = all.length > 1 ? all.at(-1)!.t - all[0].t : 0;
  const available = PERIODS.filter((p, i) => i === 0 || span >= PERIODS[i - 1].days * DAY * 1.05);
  const active = available.find((p) => p.key === period) ?? available.at(-1)!;
  const days = active.days;

  const points = useMemo(() => {
    if (all.length < 2) return all;
    const from = all.at(-1)!.t - days * DAY;
    return all.filter((p) => p.t >= from);
  }, [all, days]);

  const geo = useMemo(() => {
    if (points.length < 2 || width === 0) return null;
    const cs = points.map((p) => p.c);
    const min = Math.min(...cs);
    const max = Math.max(...cs);
    const span = max - min || 1;
    const x = (i: number) => (i / (points.length - 1)) * width;
    const y = (c: number) => PAD + (1 - (c - min) / span) * (HEIGHT - PAD * 2);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');
    const area = `${line} L${width},${HEIGHT} L0,${HEIGHT} Z`;
    return { line, area, min, max, x, y, baseY: y(points[0].c) };
  }, [points, width]);

  if (all.length < 2) return null;
  const first = points[0];
  const last = points.at(-1)!;
  const change = ((last.c - first.c) / first.c) * 100;
  const color = dirColor(theme, change);

  const pick = (e: GestureResponderEvent) => {
    if (!width) return;
    const i = Math.round((e.nativeEvent.locationX / width) * (points.length - 1));
    setTouch(Math.max(0, Math.min(points.length - 1, i)));
  };
  const hit = touch != null ? points[touch] : null;
  const hitChange = hit ? ((hit.c - first.c) / first.c) * 100 : 0;

  return (
    <View>
      <View style={styles.legend}>
        {hit ? (
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
            {fmtDate(hit.t)} · {usd(hit.c)}
          </Text>
        ) : (
          <Text style={{ color: theme.subtext, fontSize: 12 }}>최근 {active.label} · 차트를 눌러 날짜별 가격 보기</Text>
        )}
        <Text style={{ color: hit ? dirColor(theme, hitChange) : color, fontSize: 12, fontWeight: '700' }}>
          {(hit ? hitChange : change) >= 0 ? '+' : ''}
          {(hit ? hitChange : change).toFixed(1)}%
        </Text>
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        // Claim the touch so dragging along the chart scrubs instead of scrolling the page.
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setTouch(null)}
        onResponderTerminate={() => setTouch(null)}>
        {geo && (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.25} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={geo.baseY} y2={geo.baseY} stroke={theme.border} strokeDasharray="4 4" />
            <Path d={geo.area} fill="url(#fill)" />
            <Path d={geo.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {hit && touch != null ? (
              <>
                <Line x1={geo.x(touch)} x2={geo.x(touch)} y1={0} y2={HEIGHT} stroke={theme.subtext} strokeWidth={1} />
                <Circle cx={geo.x(touch)} cy={geo.y(hit.c)} r={4} fill={color} stroke={theme.card} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        )}
      </View>
      {geo && (
        <View style={styles.axis}>
          <Text style={[styles.axisText, { color: theme.subtext }]}>{fmtDate(first.t)}</Text>
          <Text style={[styles.axisText, { color: theme.subtext }]}>
            저 {usd(geo.min)} · 고 {usd(geo.max)}
          </Text>
          <Text style={[styles.axisText, { color: theme.subtext }]}>{fmtDate(last.t)}</Text>
        </View>
      )}
      {available.length > 1 ? (
        <View style={styles.periods}>
          {available.map((p) => {
            const on = p.key === active.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[styles.period, { backgroundColor: on ? theme.input : 'transparent' }]}
                accessibilityLabel={`${p.label} 차트`}>
                <Text style={{ color: on ? theme.text : theme.subtext, fontSize: 12, fontWeight: on ? '700' : '500' }}>{p.key}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11 },
  periods: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  period: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8 },
});
