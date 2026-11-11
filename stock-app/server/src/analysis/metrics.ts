// Rates each key metric as good / neutral / bad with a one-line Korean reason.
// Thresholds are broad rules of thumb for US stocks; what is "normal" differs by industry,
// so every comment explains the threshold it used.

import type { Fundamentals, MetricEval, MetricGroup, MetricRating, Quote, Technicals } from '../types.ts';

const usd = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`;

/** Parses Finviz strings like "38.15", "11.72%", "-0.5" → number; "-" / empty → null. */
export function num(s: string | null | undefined): number | null {
  if (s == null) return null;
  const m = s.replace(/,/g, '').match(/^\s*(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** "1.06 (0.31%)" → 0.31 */
export function dividendYield(s: string | null | undefined): number | null {
  const m = s?.match(/\((-?\d+(?:\.\d+)?)%\)/);
  return m ? Number(m[1]) : null;
}

type Band = [limit: number, rating: MetricRating, comment: string];

/** Picks the first band whose limit is >= x (bands sorted ascending; the last should be Infinity). */
function band(x: number, bands: Band[]): { rating: MetricRating; comment: string } {
  const b = bands.find(([limit]) => x <= limit) ?? bands[bands.length - 1];
  return { rating: b[1], comment: b[2] };
}

export function evaluateMetrics(q: Quote, t: Technicals, f: Fundamentals | null): MetricEval[] {
  const out: MetricEval[] = [];
  const add = (group: MetricGroup, key: string, label: string, value: string, rating: MetricRating, comment: string) =>
    out.push({ group, key, label, value, rating, comment });

  // ── 밸류에이션
  const eps = num(f?.epsTtm);
  const pe = num(f?.pe);
  if (pe != null)
    add('밸류에이션', 'pe', 'P/E', f!.pe!, ...rb(band(pe, [
      [18, 'good', '이익 대비 주가가 낮은 편이에요 (18배 이하).'],
      [30, 'neutral', '시장 평균 수준이에요 (18~30배).'],
      [Infinity, 'bad', '이익 대비 주가가 비싼 편이에요 (30배 초과). 높은 성장이 이어져야 정당화돼요.'],
    ])));
  else if (eps != null && eps < 0) add('밸류에이션', 'pe', 'P/E', '적자', 'bad', '최근 12개월 순이익이 적자라 P/E를 계산할 수 없어요.');

  const fpe = num(f?.forwardPe);
  if (fpe != null) {
    const r = band(fpe, [
      [18, 'good', '내년 예상 이익 기준으로 낮은 편이에요.'],
      [28, 'neutral', '내년 예상 이익 기준으로 보통이에요.'],
      [Infinity, 'bad', '내년 예상 이익 기준으로도 비싼 편이에요.'],
    ]);
    const trend = pe != null ? (fpe < pe ? ' 현재 P/E보다 낮아 이익 증가가 예상돼요.' : ' 현재 P/E보다 높아 이익 감소가 예상돼요.') : '';
    add('밸류에이션', 'forwardPe', '선행 P/E', f!.forwardPe!, r.rating, r.comment + trend);
  }

  const peg = num(f?.peg);
  if (peg != null && peg > 0)
    add('밸류에이션', 'peg', 'PEG', f!.peg!, ...rb(band(peg, [
      [1, 'good', '성장률을 감안하면 저평가예요 (1 이하).'],
      [2, 'neutral', '성장률을 감안하면 적정 수준이에요 (1~2).'],
      [Infinity, 'bad', '성장률에 비해 주가가 비싸요 (2 초과).'],
    ])));

  const ps = num(f?.ps);
  if (ps != null)
    add('밸류에이션', 'ps', 'P/S', f!.ps!, ...rb(band(ps, [
      [2, 'good', '매출 대비 주가가 낮아요 (2배 이하).'],
      [8, 'neutral', '매출 대비 보통 수준이에요 (2~8배). 업종마다 차이가 커요.'],
      [Infinity, 'bad', '매출 대비 주가가 높아요 (8배 초과). 높은 이익률이나 성장이 필요해요.'],
    ])));

  const tu = f?.targetUpside;
  if (tu != null && f?.targetPrice != null)
    add('밸류에이션', 'target', '애널리스트 목표가', `${usd(f.targetPrice)} (${pct(tu)})`, ...rb(band(tu, [
      [-5, 'bad', '목표가가 현재가보다 낮아요. 이미 기대를 넘어선 가격일 수 있어요.'],
      [15, 'neutral', '목표가와 현재가 차이가 크지 않아요.'],
      [Infinity, 'good', '목표가까지 15% 넘게 남아 있어요.'],
    ])));

  const rec = f?.analystRecom;
  if (rec != null)
    add('밸류에이션', 'recom', '애널리스트 의견', `${rec.toFixed(2)} (1 매수 ~ 5 매도)`, ...rb(band(rec, [
      [2, 'good', '애널리스트 대다수가 매수 의견이에요.'],
      [3, 'neutral', '매수와 보유 의견이 섞여 있어요.'],
      [Infinity, 'bad', '보유·매도 의견이 우세해요.'],
    ])));

  // ── 성장성
  const growth = (key: string, label: string, raw: string | null | undefined, what: string, goodAt: number) => {
    const g = num(raw);
    if (g == null) return;
    add('성장성', key, label, raw!, ...rb(band(g, [
      [0, 'bad', `${what}이 줄어들고 있어요.`],
      [goodAt, 'neutral', `${what}이 소폭 늘고 있어요 (${goodAt}% 미만).`],
      [Infinity, 'good', `${what}이 빠르게 늘고 있어요 (${goodAt}% 이상).`],
    ])));
  };
  growth('salesQoQ', '매출 성장 (전년 동기 대비)', f?.salesQoQ, '매출', 10);
  growth('epsQoQ', 'EPS 성장 (전년 동기 대비)', f?.epsQoQ, '주당순이익', 10);
  growth('epsNextY', '내년 EPS 성장 전망', f?.epsNextY, '예상 주당순이익', 15);

  const surprise = (key: string, label: string, raw: string | null | undefined, what: string, margin: number) => {
    const x = num(raw);
    if (x == null) return;
    add('성장성', key, label, raw!, ...rb(band(x, [
      [-margin, 'bad', `직전 분기 ${what}이 예상치를 ${margin}% 넘게 밑돌았어요.`],
      [margin, 'neutral', `직전 분기 ${what}이 예상치와 비슷했어요 (±${margin}%).`],
      [Infinity, 'good', `직전 분기 ${what}이 예상치를 ${margin}% 넘게 웃돌았어요.`],
    ])));
  };
  surprise('epsSurprise', 'EPS 서프라이즈 (예상 대비)', f?.epsSurprise, '주당순이익', 3);
  surprise('salesSurprise', '매출 서프라이즈 (예상 대비)', f?.salesSurprise, '매출', 1);

  // ── 수익성
  if (eps != null)
    add('수익성', 'eps', 'EPS (최근 12개월)', f!.epsTtm!, eps > 0 ? 'good' : 'bad', eps > 0 ? '흑자를 내고 있어요.' : '적자 상태예요.');

  const margin = num(f?.profitMargin);
  if (margin != null)
    add('수익성', 'margin', '순이익률', f!.profitMargin!, ...rb(band(margin, [
      [0, 'bad', '매출을 내고도 손실을 보고 있어요.'],
      [5, 'bad', '매출 대비 남기는 이익이 적어요 (5% 미만).'],
      [20, 'neutral', '보통 수준의 이익률이에요 (5~20%).'],
      [Infinity, 'good', '매출의 20% 넘게 이익으로 남겨요.'],
    ])));

  const roe = num(f?.roe);
  if (roe != null) {
    const r = band(roe, [
      [5, 'bad', '자본 대비 이익이 낮아요 (5% 미만).'],
      [15, 'neutral', '자본 대비 이익이 보통이에요 (5~15%).'],
      [Infinity, 'good', '자본을 효율적으로 굴려 이익을 내요 (15% 이상).'],
    ]);
    const note = roe > 100 ? ' 다만 자사주 매입 등으로 자본이 작아져 수치가 부풀려졌을 수 있어요.' : '';
    add('수익성', 'roe', 'ROE', f!.roe!, r.rating, r.comment + note);
  }

  // ── 재무 건전성
  const de = num(f?.debtEq);
  if (de != null)
    add('재무 건전성', 'debtEq', '부채비율 (D/E)', f!.debtEq!, ...rb(de < 0
      ? { rating: 'bad', comment: '자본이 마이너스(자본잠식)예요.' }
      : band(de, [
          [0.5, 'good', '부채가 자본의 절반 이하로 적어요.'],
          [1.5, 'neutral', '부채 수준이 보통이에요 (자본의 0.5~1.5배).'],
          [Infinity, 'bad', '부채가 자본의 1.5배를 넘어요. 금리 부담에 주의하세요.'],
        ])));

  if (f?.dividend) {
    const y = dividendYield(f.dividend);
    if (y == null || y === 0) add('재무 건전성', 'dividend', '배당', '없음', 'neutral', '배당을 주지 않아요. 성장주에서는 흔해요.');
    else
      add('재무 건전성', 'dividend', '배당', f.dividend, ...rb(band(y, [
        [1, 'neutral', '배당 수익률이 낮아요 (1% 미만).'],
        [6, 'good', '배당 수익률이 괜찮아요 (1~6%).'],
        [Infinity, 'neutral', '배당 수익률이 매우 높아요 (6% 초과). 주가 하락 탓인지, 배당을 유지할 수 있는지 확인하세요.'],
      ])));
  }

  // ── 위험·수급
  const beta = num(f?.beta);
  if (beta != null)
    add('위험·수급', 'beta', '베타', f!.beta!, ...rb(band(beta, [
      [0.8, 'good', '시장보다 덜 출렁이는 방어적인 종목이에요.'],
      [1.5, 'neutral', '시장과 비슷하게 움직여요.'],
      [Infinity, 'bad', '시장보다 크게 출렁여요 (1.5 초과).'],
    ])));

  if (t.volatility != null)
    add('위험·수급', 'volatility', '변동성 (연환산)', `${t.volatility.toFixed(0)}%`, ...rb(band(t.volatility, [
      [25, 'good', '주가 변동이 작은 편이에요.'],
      [45, 'neutral', '주가 변동이 보통이에요 (25~45%).'],
      [Infinity, 'bad', '주가 변동이 커요 (45% 초과).'],
    ])));

  const sf = num(f?.shortFloat);
  if (sf != null)
    add('위험·수급', 'shortFloat', '공매도 비율', f!.shortFloat!, ...rb(band(sf, [
      [3, 'good', '하락에 거는 공매도가 적어요.'],
      [10, 'neutral', '공매도가 다소 있어요 (3~10%).'],
      [Infinity, 'bad', '공매도가 많아요 (10% 초과). 하락을 예상하는 투자자가 많다는 뜻이에요.'],
    ])));

  if (t.volumeRatio != null) {
    const v = t.volumeRatio;
    const up = q.changePercent >= 0;
    const value = `평균의 ${v.toFixed(1)}배`;
    if (v >= 1.5) add('위험·수급', 'volume', '거래량', value, up ? 'good' : 'bad', up ? '거래량이 늘며 올랐어요. 매수세가 강해요.' : '거래량이 늘며 내렸어요. 매도세가 강해요.');
    else if (v <= 0.5) add('위험·수급', 'volume', '거래량', value, 'neutral', '거래가 한산해요.');
    else add('위험·수급', 'volume', '거래량', value, 'neutral', '평소 수준의 거래량이에요.');
  }

  // ── 기술적 흐름
  if (t.rsi14 != null)
    add('기술적 흐름', 'rsi', 'RSI (14)', t.rsi14.toFixed(1), ...rb(band(t.rsi14, [
      [30, 'good', '과매도 구간이에요 (30 이하). 반등 여지가 있어요.'],
      [70, 'neutral', '과열도 침체도 아닌 구간이에요.'],
      [Infinity, 'bad', '과매수 구간이에요 (70 이상). 단기 조정 가능성이 있어요.'],
    ])));

  const ma = (key: string, label: string, v: number | null, horizon: string) => {
    if (v == null) return;
    const gap = ((q.price - v) / v) * 100;
    add('기술적 흐름', key, label, `${usd(v)} (${pct(gap)})`, gap >= 0 ? 'good' : 'bad',
      gap >= 0 ? `주가가 ${horizon} 추세선 위에 있어요.` : `주가가 ${horizon} 추세선 아래에 있어요.`);
  };
  ma('sma20', '20일 이동평균', t.sma20, '단기');
  ma('sma50', '50일 이동평균', t.sma50, '중기');
  ma('sma200', '200일 이동평균', t.sma200, '장기');

  if (t.macdHist != null)
    add('기술적 흐름', 'macd', 'MACD', t.macdHist.toFixed(2), t.macdHist >= 0 ? 'good' : 'bad',
      t.macdHist >= 0 ? 'MACD가 시그널선 위에 있어 상승 탄력이 있어요.' : 'MACD가 시그널선 아래에 있어 상승 탄력이 약해요.');

  if (t.rangePosition != null)
    add('기술적 흐름', 'range', '52주 범위 내 위치', `${t.rangePosition.toFixed(0)}%`, ...rb(band(t.rangePosition, [
      [20, 'bad', '52주 최저가 근처예요. 하락 추세가 이어지는 중일 수 있어요.'],
      [80, 'neutral', '52주 범위 중간이에요.'],
      [Infinity, 'good', '52주 최고가 근처예요. 상승 추세가 강해요.'],
    ])));

  return out;
}

function rb(r: { rating: MetricRating; comment: string }): [MetricRating, string] {
  return [r.rating, r.comment];
}
