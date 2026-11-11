import type { Direction, EarningsInfo, Fundamentals, NewsItem, Outlook, Quote, Signal, Technicals } from '../types.ts';
import { daysSinceReport, daysToNextReport } from './earnings.ts';
import { recentEvents } from './events.ts';

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const pct = (x: number, digits = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}%`;

export function toDirection(score: number, threshold = 15): Direction {
  return score >= threshold ? 'up' : score <= -threshold ? 'down' : 'neutral';
}

function weightedScore(signals: Signal[]): number {
  const w = signals.reduce((a, s) => a + s.weight, 0);
  if (!w) return 0;
  return (signals.reduce((a, s) => a + s.effect * s.weight, 0) / w) * 100;
}

export function recentNewsScore(news: NewsItem[], now = Date.now()): { avg: number; count: number } {
  const week = news.filter((n) => n.publishedAt && now - Date.parse(n.publishedAt) < 7 * 86_400_000);
  if (!week.length) return { avg: 0, count: 0 };
  // Newer headlines count more (half-life ~2 days).
  let sum = 0;
  let wsum = 0;
  for (const n of week) {
    const ageDays = (now - Date.parse(n.publishedAt!)) / 86_400_000;
    const w = Math.pow(0.5, ageDays / 2);
    sum += n.sentiment * w;
    wsum += w;
  }
  return { avg: sum / wsum, count: week.length };
}

export function buildOutlook(
  quote: Quote,
  t: Technicals & { macdPrevHist: number | null },
  f: Fundamentals | null,
  news: NewsItem[],
  earnings: EarningsInfo | null = null,
  now = Date.now(),
): Outlook {
  const p = quote.price;
  const signals: Signal[] = [];
  const add = (s: Signal) => signals.push({ ...s, effect: clamp(s.effect) });

  // ── Mid-term: trend, analysts, earnings expectations ──
  if (t.sma200) {
    const d = (p / t.sma200 - 1) * 100;
    add({
      key: 'sma200', label: '200일 이동평균 대비', value: pct(d), weight: 2, horizon: 'mid', effect: d / 15,
      reason: d >= 0 ? '장기 추세선 위에서 거래되어 장기 상승 추세가 유지되고 있습니다.' : '장기 추세선 아래에 있어 장기 추세가 약합니다.',
    });
  }
  if (t.sma50 && t.sma200) {
    const golden = t.sma50 > t.sma200;
    add({
      key: 'cross', label: '50일선 vs 200일선', value: golden ? '골든크로스 상태' : '데드크로스 상태', weight: 1.5, horizon: 'mid',
      effect: golden ? 0.7 : -0.7,
      reason: golden ? '중기 이동평균이 장기 이동평균 위에 있습니다.' : '중기 이동평균이 장기 이동평균 아래에 있습니다.',
    });
  }
  if (t.return6m != null) {
    add({
      key: 'ret6m', label: '6개월 수익률', value: pct(t.return6m), weight: 1, horizon: 'mid', effect: t.return6m / 30,
      reason: t.return6m >= 0 ? '최근 6개월간 주가가 상승했습니다.' : '최근 6개월간 주가가 하락했습니다.',
    });
  }
  if (f?.analystRecom != null) {
    const r = f.analystRecom;
    const word = r <= 1.5 ? '적극 매수' : r <= 2.5 ? '매수' : r <= 3.5 ? '보유' : r <= 4.5 ? '매도' : '적극 매도';
    add({
      key: 'recom', label: '애널리스트 평균 의견', value: `${r.toFixed(2)} (${word})`, weight: 1.5, horizon: 'mid',
      effect: (3 - r) / 1.5,
      reason: `애널리스트 평균 의견이 '${word}'입니다 (1=적극 매수, 5=매도).`,
    });
  }
  if (f?.targetUpside != null) {
    add({
      key: 'target', label: '목표주가 상승여력', value: `${pct(f.targetUpside)} ($${f.targetPrice?.toFixed(2)})`, weight: 1.5,
      horizon: 'mid', effect: f.targetUpside / 25,
      reason: f.targetUpside >= 0 ? '애널리스트 평균 목표가가 현재가보다 높습니다.' : '현재가가 애널리스트 평균 목표가를 넘어섰습니다.',
    });
  }
  const epsGrowth = f?.epsNextY?.endsWith('%') ? parseFloat(f.epsNextY) : NaN;
  if (Number.isFinite(epsGrowth)) {
    add({
      key: 'epsNextY', label: '내년 EPS 성장 전망', value: pct(epsGrowth), weight: 0.8, horizon: 'mid', effect: epsGrowth / 30,
      reason: epsGrowth >= 0 ? '내년 주당순이익 증가가 예상됩니다.' : '내년 주당순이익 감소가 예상됩니다.',
    });
  }

  // ── Short-term: momentum, oscillators, news ──
  if (t.sma20) {
    const d = (p / t.sma20 - 1) * 100;
    add({
      key: 'sma20', label: '20일 이동평균 대비', value: pct(d), weight: 1, horizon: 'short', effect: d / 5,
      reason: d >= 0 ? '단기 추세선 위에 있습니다.' : '단기 추세선 아래로 내려왔습니다.',
    });
  }
  if (t.macdHist != null) {
    const rising = t.macdPrevHist != null && t.macdHist > t.macdPrevHist;
    const pos = t.macdHist > 0;
    const effect = pos ? (rising ? 0.8 : 0.3) : rising ? -0.3 : -0.8;
    add({
      key: 'macd', label: 'MACD', value: `${pos ? '시그널 위' : '시그널 아래'} · ${rising ? '확대/반등 중' : '축소/약화 중'}`,
      weight: 1.2, horizon: 'short', effect,
      reason: pos
        ? rising ? '상승 모멘텀이 강해지고 있습니다.' : '상승 모멘텀이 둔화되고 있습니다.'
        : rising ? '하락 모멘텀이 약해지고 있습니다.' : '하락 모멘텀이 강해지고 있습니다.',
    });
  }
  if (t.rsi14 != null) {
    const r = t.rsi14;
    const [effect, reason] =
      r >= 75 ? [-0.7, '과매수 구간으로 단기 조정 가능성이 있습니다.']
      : r >= 70 ? [-0.3, '과매수 구간에 진입해 추가 상승 여력이 제한적일 수 있습니다.']
      : r >= 55 ? [0.4, '매수세가 우위인 구간입니다.']
      : r > 45 ? [0, '중립 구간입니다.']
      : r > 30 ? [-0.4, '매도세가 우위인 구간입니다.']
      : r > 25 ? [0.3, '과매도 구간에 진입해 기술적 반등 가능성이 있습니다.']
      : [0.7, '깊은 과매도 구간으로 반등 가능성이 높아졌습니다.'];
    add({ key: 'rsi', label: 'RSI(14)', value: r.toFixed(1), weight: 1, horizon: 'short', effect, reason });
  }
  if (t.return1m != null) {
    add({
      key: 'ret1m', label: '1개월 수익률', value: pct(t.return1m), weight: 0.8, horizon: 'short', effect: t.return1m / 12,
      reason: t.return1m >= 0 ? '최근 한 달간 주가가 올랐습니다.' : '최근 한 달간 주가가 내렸습니다.',
    });
  }
  // ── 실적: the surprise and the market's reaction fade over the quarter, so their weight does too.
  if (earnings) {
    const age = daysSinceReport(earnings, now);
    const fresh = age != null && age <= 45;
    const { epsSurprise: es, salesSurprise: ss } = earnings;
    if (es != null || ss != null) {
      const effect = es != null && ss != null ? 0.6 * clamp(es / 10) + 0.4 * clamp(ss / 4) : es != null ? clamp(es / 10) : clamp(ss! / 4);
      const parts = [es != null && `EPS ${pct(es)}`, ss != null && `매출 ${pct(ss)}`].filter(Boolean).join(' · ');
      add({
        key: 'surprise', label: '최근 실적 서프라이즈', value: parts, weight: fresh ? 1.4 : 0.7, horizon: 'mid', effect,
        reason:
          effect > 0.15 ? '직전 분기 실적이 시장 예상치를 웃돌았습니다.'
          : effect < -0.15 ? '직전 분기 실적이 시장 예상치를 밑돌았습니다.'
          : '직전 분기 실적은 시장 예상치에 대체로 부합했습니다.',
      });
    }
    if (earnings.reaction != null && earnings.sinceReport != null && age != null && age <= 95) {
      const r = earnings.reaction;
      const since = earnings.sinceReport;
      add({
        key: 'reaction', label: '실적 발표 후 주가 반응', value: `첫날 ${pct(r)} · 이후 누적 ${pct(since)}`,
        weight: age <= 30 ? 1.2 : 0.7, horizon: age <= 30 ? 'short' : 'mid',
        effect: 0.6 * clamp(r / 6) + 0.4 * clamp(since / 15),
        reason:
          r >= 2 ? '시장이 실적 발표를 호재로 받아들였습니다.'
          : r <= -2 ? '시장이 실적 발표를 악재로 받아들였습니다.'
          : '실적 발표에 대한 시장 반응은 크지 않았습니다.',
      });
    }
    if (earnings.epsGrowth != null || earnings.salesGrowth != null) {
      const eg = earnings.epsGrowth;
      const sg = earnings.salesGrowth;
      // EPS growth off a tiny base can be in the thousands of percent, so it is clamped hard.
      const effect = eg != null && sg != null ? 0.5 * clamp(sg / 25) + 0.5 * clamp(eg / 40) : eg != null ? clamp(eg / 40) : clamp(sg! / 25);
      add({
        key: 'growth', label: '분기 실적 성장 (전년 동기 대비)',
        value: [eg != null && `EPS ${pct(eg)}`, sg != null && `매출 ${pct(sg)}`].filter(Boolean).join(' · '),
        weight: 1, horizon: 'mid', effect,
        reason: effect > 0.15 ? '이익과 매출이 1년 전보다 늘고 있습니다.' : effect < -0.15 ? '이익이나 매출이 1년 전보다 줄었습니다.' : '1년 전과 비슷한 실적입니다.',
      });
    }
  }

  // ── 뉴스 이벤트: concrete headlines (analyst actions, guidance, legal…) from the last two weeks.
  const ev = recentEvents(news, now);
  if (ev.count > 0) {
    add({
      key: 'events', label: '최근 2주 주요 뉴스 이벤트',
      value: ev.byLabel.slice(0, 3).map((b) => `${b.label} ${b.count}`).join(' · '),
      weight: 1.3 * Math.min(1, 0.5 + ev.count / 4), horizon: 'short', effect: ev.score,
      reason:
        ev.score > 0.1 ? '최근 호재성 뉴스(의견·목표가 상향, 실적 상회 등)가 우세합니다.'
        : ev.score < -0.1 ? '최근 악재성 뉴스(의견·목표가 하향, 소송 등)가 우세합니다.'
        : '최근 주요 뉴스의 호재와 악재가 엇갈립니다.',
    });
  }

  const ns = recentNewsScore(news, now);
  if (ns.count > 0) {
    // Few headlines → less trust.
    const trust = Math.min(1, ns.count / 8);
    add({
      key: 'news', label: '최근 7일 뉴스 분위기', value: `${ns.avg >= 0 ? '+' : ''}${ns.avg.toFixed(2)} (${ns.count}건)`,
      weight: 1.2 * trust, horizon: 'short', effect: ns.avg * 2.5,
      reason: ns.avg > 0.05 ? '최근 헤드라인이 대체로 긍정적입니다.' : ns.avg < -0.05 ? '최근 헤드라인이 대체로 부정적입니다.' : '최근 헤드라인 분위기는 중립적입니다.',
    });
  }
  if (t.volumeRatio != null && t.volumeRatio >= 1.5 && Math.abs(quote.changePercent) >= 1) {
    const up = quote.changePercent > 0;
    add({
      key: 'volume', label: '거래량 급증', value: `평균의 ${t.volumeRatio.toFixed(1)}배`, weight: 0.6, horizon: 'short',
      effect: up ? 0.6 : -0.6,
      reason: up ? '거래량을 동반한 상승으로 매수세가 강합니다.' : '거래량을 동반한 하락으로 매도 압력이 큽니다.',
    });
  }

  const mid = signals.filter((s) => s.horizon === 'mid');
  const short = signals.filter((s) => s.horizon === 'short');
  const midScore = weightedScore(mid);
  const shortScore = weightedScore(short);
  const score = mid.length && short.length ? 0.6 * midScore + 0.4 * shortScore : mid.length ? midScore : shortScore;
  const direction = toDirection(score);

  // Confidence: how strongly and how consistently the signals agree.
  const totalW = signals.reduce((a, s) => a + s.weight, 0) || 1;
  const sign = Math.sign(score);
  const agreeW = signals.filter((s) => Math.sign(s.effect) === sign && s.effect !== 0).reduce((a, s) => a + s.weight, 0);
  const agreement = agreeW / totalW;
  const horizonsAgree = toDirection(shortScore) === toDirection(midScore);
  let confidence: Outlook['confidence'] =
    Math.abs(score) >= 40 && agreement >= 0.7 ? 'high' : Math.abs(score) >= 20 || agreement >= 0.6 ? 'medium' : 'low';
  if (!horizonsAgree && confidence === 'high') confidence = 'medium';
  if (signals.length < 5) confidence = 'low';
  // An imminent report can move the price either way regardless of the signals.
  const toNext = earnings ? daysToNextReport(earnings, now) : null;
  if (toNext != null && toNext <= 7 && confidence === 'high') confidence = 'medium';

  return {
    direction,
    score: Math.round(score),
    confidence,
    shortTerm: { direction: toDirection(shortScore), score: Math.round(shortScore) },
    midTerm: { direction: toDirection(midScore), score: Math.round(midScore) },
    headline: headline(toDirection(shortScore), toDirection(midScore)),
    signals: signals.sort((a, b) => Math.abs(b.effect * b.weight) - Math.abs(a.effect * a.weight)),
  };
}

const WORD: Record<Direction, string> = { up: '상승', neutral: '보합', down: '하락' };

function headline(s: Direction, m: Direction): string {
  if (s === m) {
    return s === 'neutral' ? '뚜렷한 방향성 없이 보합 흐름이 예상됩니다.' : `단기·중기 모두 ${WORD[s]} 신호가 우세합니다.`;
  }
  if (m === 'up' && s === 'down') return '중기 상승 추세 속 단기 조정 신호가 나타나고 있습니다.';
  if (m === 'down' && s === 'up') return '중기 하락 추세 속 단기 반등 신호가 나타나고 있습니다.';
  return `단기 ${WORD[s]}, 중기 ${WORD[m]} 신호입니다.`;
}
