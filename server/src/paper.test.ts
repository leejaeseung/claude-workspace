import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { PaperTrader, type Ranking } from './paper.ts';
import type { Recommendation } from './types.ts';

const T0 = Date.parse('2026-11-10T15:00:00Z'); // a Tuesday, mid-session in New York

const rec = (ticker: string, score: number) =>
  ({ ticker, name: `${ticker} Inc.`, score, reasons: [`이유 ${ticker}`] }) as unknown as Recommendation;

function setup(entries: Recommendation[], prices: Record<string, number>, scannedAt = new Date(T0 - 3_600_000).toISOString()) {
  const market = { prices: { SPY: 500, ...prices }, time: T0 };
  const ranking: Ranking = { scannedAt, entries };
  const deps = {
    ranking: () => ranking,
    quote: async (t: string) => {
      if (!(t in market.prices)) throw new Error(`no quote ${t}`);
      return { price: market.prices[t as keyof typeof market.prices], time: market.time };
    },
  };
  return { market, ranking, deps };
}

const tmpFile = async () => join(await mkdtemp(join(tmpdir(), 'paper-')), 'portfolio.json');

test('start validates the amount', async () => {
  const { deps } = setup([], {});
  const p = new PaperTrader(await tmpFile(), deps);
  await assert.rejects(p.start(10));
  await assert.rejects(p.start(Number.NaN));
  assert.equal(p.get().status, 'none');
});

test('buys the top scorers in equal slots while the market is open', async () => {
  const entries = [rec('AAA', 60), rec('BBB', 50), rec('CCC', 40), rec('DDD', 30), rec('EEE', 25), rec('FFF', 22), rec('LOW', 10)];
  const { deps } = setup(entries, { AAA: 100, BBB: 50, CCC: 20, DDD: 10, EEE: 5, FFF: 1, LOW: 1 });
  const p = new PaperTrader(await tmpFile(), deps);
  await p.start(10_000, T0);
  await p.tick(T0);
  const g = p.get(T0);
  assert.deepEqual(g.positions!.map((x) => x.ticker).sort(), ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']);
  assert.ok(Math.abs(g.cash!) < 0.01);
  // 0.25% fee on each buy
  assert.ok(Math.abs(g.fees! - 25) < 0.01);
  assert.ok(Math.abs(g.value! - 9975) < 0.01);
  assert.equal(g.trades!.length, 5);
  assert.match(g.trades![0].reason, /TOP \d위 · 점수 \+\d+/);
  assert.equal(g.benchmarkPercent, 0);
});

test('waits for the market to open before trading', async () => {
  const { deps, market } = setup([rec('AAA', 60)], { AAA: 100 });
  market.time = T0 - 5 * 3_600_000; // last trade hours ago: closed
  const p = new PaperTrader(await tmpFile(), deps);
  await p.start(1000, T0);
  await p.tick(T0);
  assert.equal(p.get(T0).positions!.length, 0);
  assert.equal(p.get(T0).marketOpen, false);
  market.time = T0 + 60_000;
  await p.tick(T0 + 60_000);
  assert.equal(p.get(T0 + 60_000).positions!.length, 1);
});

test('sells on a weak score, a falling rank or the stop-loss, and books the profit', async () => {
  const { deps, market, ranking } = setup([rec('AAA', 60), rec('BBB', 50), rec('CCC', 40)], { AAA: 100, BBB: 100, CCC: 100 });
  const p = new PaperTrader(await tmpFile(), deps);
  await p.start(5000, T0);
  await p.tick(T0);
  assert.equal(p.get(T0).positions!.length, 3);

  // Stop-loss fires on a price mark alone, without a new ranking.
  market.prices.CCC = 85;
  market.time = T0 + 600_000;
  await p.tick(T0 + 600_000);
  assert.deepEqual(p.get().positions!.map((x) => x.ticker).sort(), ['AAA', 'BBB']);
  assert.match(p.get().trades![0].reason, /손절/);

  // New ranking: AAA turns negative, BBB still fine; CCC is in cooldown so it isn't bought back.
  market.prices.AAA = 120;
  market.time = T0 + 1_200_000;
  ranking.scannedAt = new Date(T0 + 1_100_000).toISOString();
  ranking.entries = [rec('CCC', 70), rec('BBB', 50), rec('AAA', -5)];
  await p.tick(T0 + 1_200_000);
  const g = p.get();
  assert.deepEqual(g.positions!.map((x) => x.ticker), ['BBB']);
  const sellA = g.trades!.find((t) => t.side === 'sell' && t.ticker === 'AAA')!;
  assert.match(sellA.reason, /전망 점수 -5/);
  assert.ok(sellA.pnl! > 190 && sellA.pnl! < 200); // ~+20% on ~$1000, minus fees
  assert.ok(g.realizedPnl! > 0);
});

test('keeps a holding the latest scan could not analyze, and survives a restart', async () => {
  const file = await tmpFile();
  const { deps, ranking, market } = setup([rec('AAA', 60)], { AAA: 100 });
  const p = new PaperTrader(file, deps);
  await p.start(1000, T0);
  await p.tick(T0);
  ranking.entries = [];
  ranking.scannedAt = new Date(T0 + 60_000).toISOString();
  market.time = T0 + 120_000;
  await p.tick(T0 + 120_000);
  assert.equal(p.get().positions!.length, 1);

  const q = new PaperTrader(file, deps);
  await q.load();
  assert.equal(q.get().positions![0].ticker, 'AAA');
  await q.stop();
  const r = new PaperTrader(file, deps);
  await r.load();
  assert.equal(r.get().status, 'none');
});
