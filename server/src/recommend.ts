import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Analysis, Recommendation, Recommendations } from './types.ts';

/** Well-known US large caps across sectors; the tickers people have asked about are added on top. */
export const UNIVERSE = [
  // 기술·통신
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'AMD', 'CSCO', 'QCOM', 'TXN', 'IBM', 'INTU',
  'NOW', 'MU', 'INTC', 'PLTR', 'NFLX', 'UBER', 'SHOP',
  // 소비재·유통
  'AMZN', 'TSLA', 'COST', 'WMT', 'HD', 'MCD', 'KO', 'PEP', 'PG', 'NKE', 'SBUX', 'DIS', 'PM',
  // 금융
  'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'PYPL', 'COIN',
  // 헬스케어
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'AMGN', 'ISRG',
  // 에너지·산업
  'XOM', 'CVX', 'GE', 'CAT', 'BA', 'LIN',
];

export const TOP_N = 10;

type Analyzer = (ticker: string) => Promise<Analysis>;

interface Saved {
  scannedAt: string | null;
  failed: string[];
  entries: Recommendation[];
}

/** The signal list is already sorted by strength; turn the strongest ones into short "label value" lines. */
function topSignals(a: Analysis, bullish: boolean, n = 3): string[] {
  return a.outlook.signals
    .filter((s) => (bullish ? s.effect > 0.05 : s.effect < -0.05))
    .slice(0, n)
    .map((s) => `${s.label} ${s.value}`);
}

export function toRecommendation(a: Analysis): Recommendation {
  const o = a.outlook;
  return {
    ticker: a.quote.ticker,
    name: a.quote.name,
    price: a.quote.price,
    changePercent: a.quote.changePercent,
    score: o.score,
    direction: o.direction,
    confidence: o.confidence,
    shortScore: o.shortTerm.score,
    midScore: o.midTerm.score,
    headline: o.headline,
    reasons: topSignals(a, true),
    risks: topSignals(a, false, 2),
    targetUpside: a.fundamentals?.targetUpside ?? null,
    sector: a.fundamentals?.sector ?? null,
    generatedAt: a.generatedAt,
  };
}

const CONF_RANK = { high: 2, medium: 1, low: 0 } as const;

/** Highest outlook score first; on a tie, the more confident call wins. */
export function rank(entries: Recommendation[], n = TOP_N): Recommendation[] {
  return [...entries].sort((a, b) => b.score - a.score || CONF_RANK[b.confidence] - CONF_RANK[a.confidence]).slice(0, n);
}

/**
 * Periodically analyzes a fixed universe of stocks and ranks them by outlook score. A scan runs in
 * the background; the previous ranking stays available until the new one is complete.
 */
export class Recommender {
  private saved: Saved = { scannedAt: null, failed: [], entries: [] };
  private progress: { done: number; total: number } | null = null;
  private running: Promise<void> | null = null;

  constructor(
    private readonly file: string,
    private readonly analyzer: Analyzer,
    private readonly extraTickers: () => string[] = () => [],
    private readonly concurrency = 2,
  ) {}

  async load() {
    try {
      this.saved = JSON.parse(await readFile(this.file, 'utf8')) as Saved;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('recommend: could not read', this.file, e);
    }
  }

  get(): Recommendations {
    return {
      status: this.running ? 'scanning' : 'idle',
      progress: this.progress,
      scannedAt: this.saved.scannedAt,
      scanned: this.saved.entries.length,
      failed: this.saved.failed,
      items: rank(this.saved.entries),
    };
  }

  /** True when the last completed scan is older than `maxAgeMs` (or there was none). */
  isStale(maxAgeMs: number, now = Date.now()): boolean {
    return !this.saved.scannedAt || now - Date.parse(this.saved.scannedAt) >= maxAgeMs;
  }

  /** Starts a scan unless one is already running; resolves when that scan finishes. */
  scan(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = null;
      this.progress = null;
    });
    return this.running;
  }

  private async run() {
    const tickers = [...new Set([...UNIVERSE, ...this.extraTickers()])];
    const entries: Recommendation[] = [];
    const failed: string[] = [];
    this.progress = { done: 0, total: tickers.length };
    const started = Date.now();

    let next = 0;
    const worker = async () => {
      while (next < tickers.length) {
        const t = tickers[next++];
        try {
          entries.push(toRecommendation(await this.analyzer(t)));
        } catch {
          failed.push(t);
        }
        this.progress = { done: this.progress!.done + 1, total: tickers.length };
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, worker));

    // A scan where almost everything failed (e.g. the network is down) should not wipe a good ranking.
    if (entries.length < Math.min(TOP_N, tickers.length / 2) && this.saved.entries.length) {
      console.error(`recommend: scan failed for ${failed.length}/${tickers.length}, keeping previous ranking`);
      return;
    }
    this.saved = { scannedAt: new Date().toISOString(), failed, entries };
    console.log(`recommend: ranked ${entries.length}, failed ${failed.length} in ${Math.round((Date.now() - started) / 1000)}s`);
    await this.persist();
  }

  private async persist() {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(this.saved));
      await rename(`${this.file}.tmp`, this.file);
    } catch (e) {
      console.error('recommend: could not save', e);
    }
  }
}
