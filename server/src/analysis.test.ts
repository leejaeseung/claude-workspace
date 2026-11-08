import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeNews } from './analyze.ts';
import { macd, rsi, sma } from './analysis/indicators.ts';
import { buildOutlook, toDirection } from './analysis/outlook.ts';
import { headlineSentiment } from './analysis/sentiment.ts';
import { describeEarnings } from './analysis/summary.ts';
import type { Quote, Technicals } from './types.ts';

test('sma averages the last N values', () => {
  assert.equal(sma([1, 2, 3, 4, 5], 2), 4.5);
  assert.equal(sma([1, 2], 3), null);
});

test('rsi is 100 for a strictly rising series and 0 for a falling one', () => {
  const up = Array.from({ length: 40 }, (_, i) => 100 + i);
  assert.equal(rsi(up), 100);
  assert.equal(rsi([...up].reverse()), 0);
});

test('macd is positive in an uptrend', () => {
  const up = Array.from({ length: 80 }, (_, i) => 100 * 1.01 ** i);
  const m = macd(up)!;
  assert.ok(m.macd > 0);
});

test('headline sentiment', () => {
  assert.ok(headlineSentiment('Nvidia beats estimates, raises guidance') > 0.5);
  assert.ok(headlineSentiment('Tesla shares plunge after deliveries miss') < -0.5);
  assert.ok(headlineSentiment('Company did not miss expectations') > 0);
  assert.equal(headlineSentiment('Apple unveils new iPad'), 0);
});

test('toDirection thresholds', () => {
  assert.equal(toDirection(20), 'up');
  assert.equal(toDirection(-20), 'down');
  assert.equal(toDirection(5), 'neutral');
});

test('describeEarnings distinguishes past and upcoming dates', () => {
  const now = new Date('2026-11-08T00:00:00Z');
  assert.match(describeEarnings('Nov 02 AMC', now)!, /최근 실적 발표: 11월 2일 장 마감 후/);
  assert.match(describeEarnings('Nov 20 BMO', now)!, /D-12/);
  assert.match(describeEarnings('Jan 28 AMC', now)!, /다음 실적 발표: 1월 28일/);
});

test('mergeNews dedupes and sorts newest first', () => {
  const merged = mergeNews([
    [{ title: 'Stock surges on deal', url: 'a', source: 'X', publishedAt: '2026-11-01T00:00:00Z' }],
    [
      { title: 'Stock Surges On Deal!', url: 'b', source: 'Y', publishedAt: '2026-11-02T00:00:00Z' },
      { title: 'Later news', url: 'c', source: 'Y', publishedAt: '2026-11-03T00:00:00Z' },
    ],
  ]);
  assert.deepEqual(merged.map((n) => n.url), ['c', 'a']);
});

test('strong uptrend with bullish analysts reads as up', () => {
  const quote = { price: 120, changePercent: 1 } as Quote;
  const t: Technicals & { macdPrevHist: number | null } = {
    sma20: 115, sma50: 110, sma200: 95, rsi14: 62, macd: 2, macdSignal: 1, macdHist: 1, macdPrevHist: 0.5,
    return1w: 2, return1m: 6, return3m: 15, return6m: 25, return1y: 40, volatility: 25, rangePosition: 95,
    avgVolume20: 1, volumeRatio: 1,
  };
  const o = buildOutlook(quote, t, { analystRecom: 1.6, targetPrice: 140, targetUpside: 16.7, epsNextY: '20%' } as never, []);
  assert.equal(o.direction, 'up');
  assert.equal(o.shortTerm.direction, 'up');
  assert.equal(o.midTerm.direction, 'up');
});
