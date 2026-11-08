import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { CONFIDENCE_LABEL, DIRECTION_LABEL } from '@/lib/format';
import { dirColor, dirSoft, useTheme } from '@/lib/theme';
import type { Direction, Outlook } from '@/lib/types';

const ARROW: Record<Direction, string> = { up: '▲', neutral: '■', down: '▼' };

/** Horizontal gauge from -100 (bearish) to +100 (bullish). */
function Gauge({ score }: { score: number }) {
  const theme = useTheme();
  const pos = Math.max(0, Math.min(100, (score + 100) / 2));
  return (
    <View style={styles.gaugeWrap}>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeSeg, { backgroundColor: theme.down }]} />
        <View style={[styles.gaugeSeg, { backgroundColor: theme.neutral }]} />
        <View style={[styles.gaugeSeg, { backgroundColor: theme.up }]} />
      </View>
      <View style={[styles.marker, { left: `${pos}%`, borderColor: theme.card, backgroundColor: theme.text }]} />
      <View style={styles.gaugeLabels}>
        <Text style={[styles.gaugeLabel, { color: theme.subtext }]}>하락</Text>
        <Text style={[styles.gaugeLabel, { color: theme.subtext }]}>보합</Text>
        <Text style={[styles.gaugeLabel, { color: theme.subtext }]}>상승</Text>
      </View>
    </View>
  );
}

function Horizon({ label, d, score }: { label: string; d: Direction; score: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.horizon, { backgroundColor: dirSoft(theme, d) }]}>
      <Text style={{ color: theme.subtext, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: dirColor(theme, d), fontWeight: '700', fontSize: 16, marginTop: 2 }}>
        {ARROW[d]} {DIRECTION_LABEL[d]}
      </Text>
      <Text style={{ color: theme.subtext, fontSize: 12 }}>점수 {score > 0 ? `+${score}` : score}</Text>
    </View>
  );
}

export function OutlookCard({ outlook }: { outlook: Outlook }) {
  const theme = useTheme();
  const color = dirColor(theme, outlook.direction);
  return (
    <Card title="주가 방향성">
      <View style={styles.top}>
        <Text style={[styles.big, { color }]}>
          {ARROW[outlook.direction]} {DIRECTION_LABEL[outlook.direction]} 우세
        </Text>
        <View style={[styles.badge, { borderColor: theme.border }]}>
          <Text style={{ color: theme.subtext, fontSize: 12 }}>신뢰도 {CONFIDENCE_LABEL[outlook.confidence]}</Text>
        </View>
      </View>
      <Text style={[styles.headline, { color: theme.text }]}>{outlook.headline}</Text>
      <Gauge score={outlook.score} />
      <View style={styles.horizons}>
        <Horizon label="단기 (1~4주)" d={outlook.shortTerm.direction} score={outlook.shortTerm.score} />
        <Horizon label="중기 (3~6개월)" d={outlook.midTerm.direction} score={outlook.midTerm.score} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { fontSize: 26, fontWeight: '800' },
  badge: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  headline: { fontSize: 15, marginTop: 6, lineHeight: 21 },
  gaugeWrap: { marginTop: 16, marginBottom: 4 },
  gaugeTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', opacity: 0.85 },
  gaugeSeg: { flex: 1 },
  marker: { position: 'absolute', top: -5, width: 18, height: 18, marginLeft: -9, borderRadius: 9, borderWidth: 3 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  gaugeLabel: { fontSize: 11 },
  horizons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  horizon: { flex: 1, borderRadius: 10, padding: 10 },
});
