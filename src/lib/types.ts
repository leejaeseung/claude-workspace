// Copy of server/src/types.ts — keep both in sync.

export type Direction = 'up' | 'neutral' | 'down';

export interface Quote {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketTime: string; // ISO
}

export interface Technicals {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  return1w: number | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  volatility: number | null; // annualized, %
  rangePosition: number | null; // 0..100 within 52w range
  avgVolume20: number | null;
  volumeRatio: number | null; // last volume / 20d avg
}

export interface Fundamentals {
  sector: string | null;
  industry: string | null;
  country: string | null;
  marketCap: string | null;
  pe: string | null;
  forwardPe: string | null;
  peg: string | null;
  ps: string | null;
  epsTtm: string | null;
  epsNextY: string | null;
  salesQoQ: string | null;
  epsQoQ: string | null;
  profitMargin: string | null;
  roe: string | null;
  debtEq: string | null;
  dividend: string | null;
  shortFloat: string | null;
  beta: string | null;
  earningsDate: string | null;
  analystRecom: number | null; // 1 = Strong Buy … 5 = Sell
  targetPrice: number | null;
  targetUpside: number | null; // %
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null; // ISO
  sentiment: number; // -1..1
  sentimentLabel: 'positive' | 'neutral' | 'negative';
}

export interface Signal {
  key: string;
  label: string;
  value: string;
  effect: number; // -1..1, positive = bullish
  weight: number;
  horizon: 'short' | 'mid';
  reason: string;
}

export interface Outlook {
  direction: Direction;
  score: number; // -100..100
  confidence: 'low' | 'medium' | 'high';
  shortTerm: { direction: Direction; score: number };
  midTerm: { direction: Direction; score: number };
  headline: string;
  signals: Signal[];
}

export interface PricePoint {
  t: number; // unix seconds
  c: number;
}

export interface Analysis {
  quote: Quote;
  technicals: Technicals;
  fundamentals: Fundamentals | null;
  outlook: Outlook;
  summary: string[];
  news: NewsItem[];
  newsSentiment: { average: number; positive: number; negative: number; neutral: number };
  chart: PricePoint[];
  sources: { name: string; ok: boolean; error?: string }[];
  generatedAt: string;
  disclaimer: string;
}

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export type ReportStatus = 'queued' | 'running' | 'done' | 'error';

/** One background analysis per ticker. `analysis` keeps the last successful result while a re-run is in progress. */
export interface ReportSummary {
  ticker: string;
  name: string | null;
  status: ReportStatus;
  requestedAt: string; // ISO
  finishedAt: string | null; // ISO, last completed run (success or failure)
  error: string | null; // set when the latest run failed
  price: number | null;
  changePercent: number | null;
  direction: Direction | null;
  generatedAt: string | null; // ISO, when `analysis` was collected
}

export interface Report extends ReportSummary {
  analysis: Analysis | null;
}
