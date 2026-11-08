import type { Fundamentals, NewsItem, Outlook, Quote, Technicals } from '../types.ts';

const pct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`;
const usd = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STOP = new Set(
  `a an the and or but of to in on for with at by from as is are was were be been it its this that these those
  stock stocks shares share inc corp co company companies market markets nasdaq nyse s&p today why how what
  after before over under amid into about up down new says said vs than more most could would will may might
  can should here there now year years week weeks day days quarter q1 q2 q3 q4 report reports top best
  buy sell hold analyst analysts price prices investors investor trading trade wall street dow just big`.split(/\s+/),
);

/** Most frequent meaningful words across recent headlines — a cheap stand-in for "topics". */
export function keywords(news: NewsItem[], exclude: string[], limit = 6): string[] {
  const ex = new Set(exclude.flatMap((s) => s.toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean));
  const counts = new Map<string, number>();
  for (const n of news.slice(0, 40)) {
    const seen = new Set<string>();
    for (const w of n.title.toLowerCase().split(/[^a-z0-9&\-]+/)) {
      if (w.length < 3 || STOP.has(w) || ex.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

export function buildSummary(q: Quote, t: Technicals, f: Fundamentals | null, news: NewsItem[], o: Outlook): string[] {
  const out: string[] = [];

  let price = `${q.name}(${q.ticker})의 현재가는 ${usd(q.price)}로 전일 대비 ${pct(q.changePercent, 2)} 움직였습니다.`;
  if (t.rangePosition != null && q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null) {
    price += ` 52주 범위(${usd(q.fiftyTwoWeekLow)}~${usd(q.fiftyTwoWeekHigh)}) 중 ${t.rangePosition.toFixed(0)}% 지점입니다.`;
  }
  out.push(price);

  const rets = [
    t.return1w != null && `1주 ${pct(t.return1w)}`,
    t.return1m != null && `1개월 ${pct(t.return1m)}`,
    t.return3m != null && `3개월 ${pct(t.return3m)}`,
    t.return1y != null && `1년 ${pct(t.return1y)}`,
  ].filter(Boolean);
  if (rets.length) out.push(`기간별 수익률: ${rets.join(', ')}.`);

  if (t.sma50 && t.sma200) {
    const above50 = q.price > t.sma50;
    const above200 = q.price > t.sma200;
    const trend =
      above50 && above200 ? '50일·200일 이동평균선 위에 있어 추세가 견조합니다'
      : !above50 && !above200 ? '50일·200일 이동평균선 아래에 있어 추세가 약합니다'
      : above200 ? '200일선 위에 있지만 50일선 아래로 내려와 단기 조정 중입니다'
      : '50일선은 회복했지만 아직 200일선 아래에 있습니다';
    out.push(`주가는 ${trend}.`);
  }

  if (t.rsi14 != null) {
    const zone = t.rsi14 >= 70 ? '과매수' : t.rsi14 <= 30 ? '과매도' : '중립';
    let s = `RSI(14)는 ${t.rsi14.toFixed(1)}로 ${zone} 구간`;
    if (t.macdHist != null) s += `, MACD는 시그널선 ${t.macdHist > 0 ? '위' : '아래'}에 있습니다`;
    out.push(`${s}.`);
  }

  if (f) {
    const parts: string[] = [];
    if (f.analystRecom != null) parts.push(`애널리스트 평균 의견 ${f.analystRecom.toFixed(2)}점(1=적극 매수, 5=매도)`);
    if (f.targetPrice != null && f.targetUpside != null) parts.push(`평균 목표가 ${usd(f.targetPrice)}(상승여력 ${pct(f.targetUpside)})`);
    if (parts.length) out.push(`${parts.join(', ')}.`);

    const val: string[] = [];
    if (f.pe) val.push(`P/E ${f.pe}`);
    if (f.forwardPe) val.push(`선행 P/E ${f.forwardPe}`);
    if (f.salesQoQ) val.push(`매출 전년 동기 대비 ${f.salesQoQ}`);
    if (f.epsQoQ) val.push(`EPS 전년 동기 대비 ${f.epsQoQ}`);
    if (val.length) {
      let s = `밸류에이션·실적: ${val.join(', ')}`;
      const pe = parseFloat(f.pe ?? '');
      const fpe = parseFloat(f.forwardPe ?? '');
      if (pe > 0 && fpe > 0) s += fpe < pe ? ' — 선행 P/E가 더 낮아 이익 성장이 기대됩니다' : ' — 선행 P/E가 더 높아 이익 감소가 예상됩니다';
      out.push(`${s}.`);
    }
    const earn = describeEarnings(f.earningsDate);
    if (earn) out.push(earn);
  }

  const week = news.filter((n) => n.publishedAt && Date.now() - Date.parse(n.publishedAt) < 7 * 86_400_000);
  if (week.length) {
    const pos = week.filter((n) => n.sentimentLabel === 'positive').length;
    const neg = week.filter((n) => n.sentimentLabel === 'negative').length;
    let s = `최근 7일 뉴스 ${week.length}건 중 긍정 ${pos}건, 부정 ${neg}건`;
    const kw = keywords(week, [q.ticker, q.name]);
    if (kw.length) s += `. 자주 언급된 키워드: ${kw.join(', ')}`;
    out.push(`${s}.`);
  } else {
    out.push('최근 7일 내 수집된 뉴스가 없습니다.');
  }

  if (t.volatility != null) {
    const lvl = t.volatility >= 60 ? '매우 높은' : t.volatility >= 35 ? '높은' : t.volatility >= 20 ? '보통 수준의' : '낮은';
    out.push(`최근 3개월 연환산 변동성은 ${t.volatility.toFixed(0)}%로 ${lvl} 편입니다.`);
  }

  out.push(`종합: ${o.headline}`);
  return out;
}

/** Finviz shows "Nov 02 AMC": the next report date, or the last one until the next is announced. */
export function describeEarnings(raw: string | null, now = new Date()): string | null {
  const m = raw?.match(/^([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(AMC|BMO))?$/);
  if (!m) return raw ? `실적 발표일: ${raw}.` : null;
  const month = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[1]) / 3;
  if (month < 0) return `실적 발표일: ${raw}.`;
  // Pick the year that puts the date closest to today.
  const candidates = [-1, 0, 1].map((dy) => new Date(Date.UTC(now.getUTCFullYear() + dy, month, Number(m[2]))));
  const d = candidates.reduce((a, b) => (Math.abs(b.getTime() - now.getTime()) < Math.abs(a.getTime() - now.getTime()) ? b : a));
  const when = m[3] === 'AMC' ? ' 장 마감 후' : m[3] === 'BMO' ? ' 장 시작 전' : '';
  const date = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일${when}`;
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days < -1) return `최근 실적 발표: ${date} (다음 발표일은 아직 공지되지 않았습니다).`;
  if (days <= 1) return `실적 발표가 임박했습니다: ${date}. 발표 전후로 변동성이 커질 수 있습니다.`;
  return `다음 실적 발표: ${date} (D-${days}).`;
}
