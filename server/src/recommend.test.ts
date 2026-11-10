import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { rank, Recommender, toRecommendation, UNIVERSE } from './recommend.ts';
import type { Analysis, Recommendation } from './types.ts';

const analysis = (ticker: string, score: number) =>
  ({
    quote: { ticker, name: `${ticker} Inc.`, price: 100, changePercent: 1 },
    fundamentals: { targetUpside: 12, sector: 'Technology' },
    outlook: {
      score,
      direction: score >= 15 ? 'up' : score <= -15 ? 'down' : 'neutral',
      confidence: 'medium',
      shortTerm: { score },
      midTerm: { score },
      headline: 'h',
      signals: [
        { label: '200일선 대비', value: '+10%', effect: 0.8 },
        { label: 'RSI', value: '75', effect: -0.4 },
        { label: '거래량', value: '1.0배', effect: 0 },
      ],
    },
    generatedAt: '2026-11-10T00:00:00.000Z',
  }) as unknown as Analysis;

test('toRecommendation splits the strongest signals into reasons and risks', () => {
  const r = toRecommendation(analysis('AAPL', 30));
  assert.deepEqual(r.reasons, ['200일선 대비 +10%']);
  assert.deepEqual(r.risks, ['RSI 75']);
  assert.equal(r.targetUpside, 12);
});

test('rank orders by score, then confidence, and keeps the top N', () => {
  const e = (ticker: string, score: number, confidence: Recommendation['confidence']) =>
    ({ ...toRecommendation(analysis(ticker, score)), confidence }) as Recommendation;
  const out = rank([e('A', 10, 'high'), e('B', 40, 'low'), e('C', 40, 'high'), e('D', -5, 'high')], 3);
  assert.deepEqual(out.map((x) => x.ticker), ['C', 'B', 'A']);
});

test('a scan ranks the universe plus extra tickers and records failures', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'reco-')), 'r.json');
  const scores = new Map(UNIVERSE.map((t, i) => [t, i]));
  const rec = new Recommender(
    file,
    async (t) => {
      if (t === 'BAD') throw new Error('nope');
      return analysis(t, t === 'EXTRA' ? 999 : scores.get(t)!);
    },
    () => ['EXTRA', 'BAD', 'AAPL'],
  );
  assert.equal(rec.isStale(1), true);
  const p = rec.scan();
  assert.equal(rec.get().status, 'scanning');
  assert.equal(rec.scan(), p, 'a second request joins the running scan');
  await p;

  const got = rec.get();
  assert.equal(got.status, 'idle');
  assert.equal(got.scanned, UNIVERSE.length + 1);
  assert.deepEqual(got.failed, ['BAD']);
  assert.equal(got.items.length, 10);
  assert.equal(got.items[0].ticker, 'EXTRA');
  assert.equal(got.items[1].ticker, UNIVERSE.at(-1));
  assert.equal(rec.isStale(3_600_000), false);

  const reloaded = new Recommender(file, async () => analysis('X', 0));
  await reloaded.load();
  assert.equal(reloaded.get().items[0].ticker, 'EXTRA', 'ranking survives a restart');
});
