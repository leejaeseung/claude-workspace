// Paper trading: the server invests a virtual amount in the stocks the outlook ranking likes best,
// sells the ones it stops liking, and values the portfolio against SPY. One portfolio per server.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { PaperPoint, PaperPosition, PaperRules, PaperTrade, Portfolio, Recommendation } from './types.ts';

export const DEFAULT_RULES: PaperRules = {
  maxPositions: 5,
  buyRank: 10,
  buyScore: 20,
  sellScore: 0,
  sellRank: 25,
  stopLoss: -10,
  feeRate: 0.0025,
  cooldownDays: 3,
};

export const MIN_AMOUNT = 100;
export const MAX_AMOUNT = 10_000_000;
export const BENCHMARK = 'SPY';

const MIN = 60_000;
const DAY = 86_400_000;
// A quote stamped within this long of now means the regular session is trading.
const OPEN_WINDOW = 30 * MIN;
// A ranking older than this is not acted on; a fresh scan will come.
const MAX_RANKING_AGE = DAY;
const MAX_TRADES = 300;
const MAX_HISTORY = 3000;

export interface PriceQuote {
  price: number;
  time: number; // ms, when that price was set
}

export interface Ranking {
  scannedAt: string | null;
  entries: Recommendation[]; // best first
}

export interface PaperDeps {
  ranking: () => Ranking;
  quote: (ticker: string) => Promise<PriceQuote>;
}

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  cost: number; // total paid, fees included
  boughtAt: string;
}

interface State {
  startedAt: string;
  initial: number;
  cash: number;
  holdings: Holding[];
  prices: Record<string, number>; // latest marks
  benchStart: number | null;
  bench: number | null;
  realized: number;
  fees: number;
  trades: PaperTrade[]; // newest first
  history: PaperPoint[];
  marketTime: number | null; // benchmark quote time at the last mark
  markedAt: string | null;
  lastRebalanceAt: string | null;
  rebalancedScan: string | null; // the ranking the last rebalance acted on
  soldAt: Record<string, string>; // ticker → ISO, for the buy-back cooldown
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export class InvalidAmountError extends Error {}

export class PaperTrader {
  private s: State | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private open = false;

  constructor(
    private readonly file: string,
    private readonly deps: PaperDeps,
    readonly rules: PaperRules = DEFAULT_RULES,
  ) {}

  async load() {
    try {
      this.s = JSON.parse(await readFile(this.file, 'utf8')) as State | null;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('paper: could not read', this.file, e);
    }
  }

  /** Runs state changes one at a time so a tick never interleaves with a start or reset. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.chain.then(fn);
    this.chain = p.catch(() => {});
    return p;
  }

  start(amount: number, now = Date.now()): Promise<Portfolio> {
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return Promise.reject(new InvalidAmountError(`금액은 $${MIN_AMOUNT.toLocaleString()} ~ $${MAX_AMOUNT.toLocaleString()} 사이로 입력해 주세요.`));
    }
    return this.serial(async () => {
      const at = new Date(now).toISOString();
      this.s = {
        startedAt: at,
        initial: round(amount),
        cash: round(amount),
        holdings: [],
        prices: {},
        benchStart: null,
        bench: null,
        realized: 0,
        fees: 0,
        trades: [],
        history: [],
        marketTime: null,
        markedAt: null,
        lastRebalanceAt: null,
        rebalancedScan: null,
        soldAt: {},
      };
      await this.persist();
      return this.get(now);
    });
  }

  stop(): Promise<void> {
    return this.serial(async () => {
      this.s = null;
      await this.persist();
    });
  }

  get active() {
    return this.s != null;
  }

  /**
   * Updates prices, applies the stop-loss, and trades on a ranking it has not acted on yet. Trades
   * only happen while the US market is trading (judged from how fresh the SPY quote is), so they
   * use live prices rather than a stale close.
   */
  tick(now = Date.now()): Promise<void> {
    return this.serial(async () => {
      const s = this.s;
      if (!s) return;
      let bench: PriceQuote;
      try {
        bench = await this.deps.quote(BENCHMARK);
      } catch (e) {
        console.error('paper: benchmark quote failed', e);
        return;
      }
      this.open = now - bench.time < OPEN_WINDOW;
      let changed = false;

      if (s.marketTime !== bench.time || !s.markedAt) {
        for (const h of s.holdings) {
          try {
            s.prices[h.ticker] = (await this.deps.quote(h.ticker)).price;
          } catch (e) {
            console.error(`paper: quote ${h.ticker} failed`, e);
          }
        }
        s.bench = bench.price;
        s.benchStart ??= bench.price;
        s.marketTime = bench.time;
        s.markedAt = new Date(now).toISOString();
        changed = true;
      }

      if (this.open) {
        changed = this.stopLosses(now) || changed;
        const r = this.deps.ranking();
        if (r.scannedAt && r.scannedAt !== s.rebalancedScan && now - Date.parse(r.scannedAt) < MAX_RANKING_AGE) {
          await this.rebalance(r, now);
          changed = true;
        }
      }

      if (changed) {
        this.record(now);
        await this.persist();
      }
    });
  }

  private stopLosses(now: number): boolean {
    const s = this.s!;
    let sold = false;
    for (const h of [...s.holdings]) {
      const price = s.prices[h.ticker];
      if (price == null) continue;
      const ret = ((price * h.shares) / h.cost - 1) * 100;
      if (ret <= this.rules.stopLoss) {
        this.sell(h, price, `손절 기준(${this.rules.stopLoss}%) 도달: ${ret.toFixed(1)}%`, now);
        sold = true;
      }
    }
    return sold;
  }

  private async rebalance(r: Ranking, now: number) {
    const s = this.s!;
    const rules = this.rules;
    const pos = new Map(r.entries.map((e, i) => [e.ticker, { e, rank: i + 1 }]));

    // 1) Sell what the ranking no longer supports. A held stock missing from the scan is kept.
    for (const h of [...s.holdings]) {
      const x = pos.get(h.ticker);
      if (!x) continue;
      const reason =
        x.e.score < rules.sellScore
          ? `전망 점수 ${sign(x.e.score)}로 하락`
          : x.rank > rules.sellRank
            ? `순위 ${x.rank}위로 밀림 (점수 ${sign(x.e.score)})`
            : null;
      if (!reason) continue;
      const price = await this.price(h.ticker);
      if (price != null) this.sell(h, price, reason, now);
    }

    // 2) Fill empty slots with the best-ranked stocks, an equal share of the portfolio each.
    const held = new Set(s.holdings.map((h) => h.ticker));
    const cooling = (t: string) => s.soldAt[t] && now - Date.parse(s.soldAt[t]) < rules.cooldownDays * DAY;
    const picks = r.entries
      .slice(0, rules.buyRank)
      .map((e, i) => ({ e, rank: i + 1 }))
      .filter(({ e }) => e.score >= rules.buyScore && !held.has(e.ticker) && !cooling(e.ticker))
      .slice(0, Math.max(0, rules.maxPositions - s.holdings.length));
    const slot = this.total() / rules.maxPositions;
    for (let i = 0; i < picks.length; i++) {
      const { e, rank } = picks[i];
      const amount = Math.min(slot, s.cash / (picks.length - i));
      if (amount < Math.max(1, slot * 0.1)) continue;
      const price = await this.price(e.ticker);
      if (price == null) continue;
      const why = e.reasons[0] ? ` · ${e.reasons[0]}` : '';
      this.buy(e, price, amount, `TOP ${rank}위 · 점수 ${sign(e.score)}${why}`, now);
    }

    s.rebalancedScan = r.scannedAt;
    s.lastRebalanceAt = new Date(now).toISOString();
  }

  private async price(ticker: string): Promise<number | null> {
    try {
      const p = (await this.deps.quote(ticker)).price;
      this.s!.prices[ticker] = p;
      return p;
    } catch (e) {
      console.error(`paper: quote ${ticker} failed, skipping trade`, e);
      return null;
    }
  }

  private buy(e: Recommendation, price: number, amount: number, reason: string, now: number) {
    const s = this.s!;
    const fee = amount * this.rules.feeRate;
    const shares = (amount - fee) / price;
    s.cash -= amount;
    s.fees += fee;
    s.holdings.push({ ticker: e.ticker, name: e.name, shares, cost: amount, boughtAt: new Date(now).toISOString() });
    this.log({ side: 'buy', ticker: e.ticker, name: e.name, shares, price, amount: amount - fee, fee, pnl: null, reason }, now);
  }

  private sell(h: Holding, price: number, reason: string, now: number) {
    const s = this.s!;
    const gross = h.shares * price;
    const fee = gross * this.rules.feeRate;
    const pnl = gross - fee - h.cost;
    s.cash += gross - fee;
    s.fees += fee;
    s.realized += pnl;
    s.holdings = s.holdings.filter((x) => x !== h);
    s.soldAt[h.ticker] = new Date(now).toISOString();
    this.log({ side: 'sell', ticker: h.ticker, name: h.name, shares: h.shares, price, amount: gross, fee, pnl, reason }, now);
  }

  private log(t: Omit<PaperTrade, 'at'>, now: number) {
    const s = this.s!;
    s.trades.unshift({
      ...t,
      at: new Date(now).toISOString(),
      shares: round(t.shares, 4),
      amount: round(t.amount),
      fee: round(t.fee),
      pnl: t.pnl == null ? null : round(t.pnl),
    });
    s.trades.length = Math.min(s.trades.length, MAX_TRADES);
    console.log(`paper: ${t.side} ${t.ticker} ${t.shares.toFixed(4)} @ ${t.price} (${t.reason})`);
  }

  private holdingValue(h: Holding) {
    return h.shares * (this.s!.prices[h.ticker] ?? h.cost / h.shares);
  }

  private total() {
    const s = this.s!;
    return s.cash + s.holdings.reduce((sum, h) => sum + this.holdingValue(h), 0);
  }

  private benchValue() {
    const s = this.s!;
    return s.benchStart && s.bench ? (s.initial * s.bench) / s.benchStart : null;
  }

  /** One point per hour; the newest mark within the hour replaces the previous one. */
  private record(now: number) {
    const s = this.s!;
    const bench = this.benchValue();
    const p: PaperPoint = { t: Math.floor(now / 1000), value: round(this.total()), benchmark: bench == null ? null : round(bench) };
    const last = s.history.at(-1);
    if (last && Math.floor(last.t / 3600) === Math.floor(p.t / 3600) && s.history.length > 1) s.history[s.history.length - 1] = p;
    else s.history.push(p);
    if (s.history.length > MAX_HISTORY) s.history.splice(1, s.history.length - MAX_HISTORY);
  }

  get(now = Date.now()): Portfolio {
    const s = this.s;
    if (!s) return { status: 'none', rules: this.rules };
    const value = this.total();
    const ranking = this.deps.ranking().entries;
    const rankOf = new Map(ranking.map((e, i) => [e.ticker, { score: e.score, rank: i + 1 }]));
    const positions: PaperPosition[] = s.holdings
      .map((h) => {
        const price = s.prices[h.ticker] ?? h.cost / h.shares;
        const v = h.shares * price;
        return {
          ticker: h.ticker,
          name: h.name,
          shares: round(h.shares, 4),
          avgCost: round(h.cost / h.shares),
          price: round(price),
          value: round(v),
          pnl: round(v - h.cost),
          pnlPercent: round((v / h.cost - 1) * 100),
          weight: round((v / value) * 100, 1),
          score: rankOf.get(h.ticker)?.score ?? null,
          rank: rankOf.get(h.ticker)?.rank ?? null,
          boughtAt: h.boughtAt,
        };
      })
      .sort((a, b) => b.value - a.value);
    const bench = this.benchValue();
    // Only the ranking-driven state can be stale on a fresh load; a market check needs a tick.
    const markedRecently = s.markedAt != null && now - Date.parse(s.markedAt) < 20 * MIN;
    return {
      status: 'active',
      rules: this.rules,
      startedAt: s.startedAt,
      initial: s.initial,
      cash: round(s.cash),
      value: round(value),
      pnl: round(value - s.initial),
      pnlPercent: round((value / s.initial - 1) * 100),
      realizedPnl: round(s.realized),
      fees: round(s.fees),
      benchmarkPercent: bench == null ? null : round((bench / s.initial - 1) * 100),
      marketOpen: this.open && markedRecently,
      markedAt: s.markedAt,
      lastRebalanceAt: s.lastRebalanceAt,
      positions,
      trades: s.trades,
      history: s.history,
    };
  }

  private async persist() {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(this.s));
      await rename(`${this.file}.tmp`, this.file);
    } catch (e) {
      console.error('paper: could not save', e);
    }
  }
}
