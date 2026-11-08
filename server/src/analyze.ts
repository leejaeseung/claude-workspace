import { computeTechnicals } from './analysis/indicators.ts';
import { buildOutlook } from './analysis/outlook.ts';
import { headlineSentiment, label } from './analysis/sentiment.ts';
import { buildSummary } from './analysis/summary.ts';
import { getFinviz } from './sources/finviz.ts';
import { getGoogleNews } from './sources/google.ts';
import { translateToKorean } from './sources/translate.ts';
import { getHistory, getYahooNews, type RawNews } from './sources/yahoo.ts';
import type { Analysis, NewsItem } from './types.ts';

export const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;

const DISCLAIMER =
  '이 분석은 공개 데이터와 기술적 지표·헤드라인을 규칙에 따라 자동 집계한 참고 자료이며, 투자 권유나 수익을 보장하지 않습니다. 투자 판단과 책임은 본인에게 있습니다.';

function normTitle(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);
}

export function mergeNews(lists: RawNews[][], limit = 40): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const n of lists.flat()) {
    const key = normTitle(n.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const s = headlineSentiment(n.title);
    merged.push({ ...n, titleKo: null, sentiment: Math.round(s * 100) / 100, sentimentLabel: label(s) });
  }
  return merged
    .sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0))
    .slice(0, limit);
}

async function settle<T>(name: string, p: Promise<T>) {
  try {
    return { name, ok: true as const, value: await p };
  } catch (e) {
    return { name, ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function analyze(ticker: string): Promise<Analysis> {
  // Price history is required (it also verifies the ticker is a US listing); everything else is best-effort.
  const history = await getHistory(ticker);
  const sym = history.quote.ticker;

  const [finviz, yahooNews, googleNews] = await Promise.all([
    settle('Finviz', getFinviz(sym)),
    settle('Yahoo Finance 뉴스', getYahooNews(sym)),
    settle('Google 뉴스', getGoogleNews(sym, history.quote.name)),
  ]);

  const closes = history.points.map((p) => p.c);
  const technicals = computeTechnicals(closes, history.volumes, history.quote.fiftyTwoWeekHigh, history.quote.fiftyTwoWeekLow);
  const fundamentals = finviz.ok ? finviz.value.fundamentals : null;
  const news = mergeNews([
    finviz.ok ? finviz.value.news : [],
    yahooNews.ok ? yahooNews.value : [],
    googleNews.ok ? googleNews.value : [],
  ]);

  // Best-effort: news still shows in English if translation fails.
  const translation = await settle('Google 번역', translateToKorean(news.map((n) => n.title)));
  if (translation.ok) news.forEach((n, i) => (n.titleKo = translation.value[i]));

  const outlook = buildOutlook(history.quote, technicals, fundamentals, news);
  const summary = buildSummary(history.quote, technicals, fundamentals, news, outlook);

  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const n of news) counts[n.sentimentLabel]++;

  const { macdPrevHist: _unused, ...tech } = technicals;
  return {
    quote: history.quote,
    technicals: tech,
    fundamentals,
    outlook,
    summary,
    news,
    newsSentiment: {
      average: news.length ? Math.round((news.reduce((a, n) => a + n.sentiment, 0) / news.length) * 100) / 100 : 0,
      ...counts,
    },
    chart: history.points.slice(-126),
    sources: [
      { name: 'Yahoo Finance 시세', ok: true },
      ...[finviz, yahooNews, googleNews, translation].map((s) => (s.ok ? { name: s.name, ok: true } : { name: s.name, ok: false, error: s.error })),
    ],
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}
