import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { usd } from '@/lib/format';
import { dirColor, useTheme } from '@/lib/theme';
import type { PricePoint } from '@/lib/types';

const HEIGHT = 160;
const PAD = 6;

export function PriceChart({ points }: { points: PricePoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

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
    return { line, area, min, max, baseY: y(points[0].c) };
  }, [points, width]);

  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1)!;
  const change = ((last.c - first.c) / first.c) * 100;
  const color = dirColor(theme, change);
  const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' });

  return (
    <View>
      <View style={styles.legend}>
        <Text style={{ color: theme.subtext, fontSize: 12 }}>최근 6개월</Text>
        <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(1)}%
        </Text>
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {geo && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.25} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={geo.baseY} y2={geo.baseY} stroke={theme.border} strokeDasharray="4 4" />
            <Path d={geo.area} fill="url(#fill)" />
            <Path d={geo.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11 },
});
