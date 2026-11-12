import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dividendYield, evaluateMetrics, num } from './analysis/metrics.ts';
import type { Fundamentals, Quote, Technicals } from './types.ts';

const quote = { price: 100, changePercent: 2 } as Quote;
const tech: Technicals = {
  sma20: 95, sma50: 105, sma200: null, rsi14: 75, macd: 1, macdSignal: 0.5, macdHist: 0.5,
  return1w: null, return1m: null, return3m: null, return6m: null, return1y: null,
  volatility: 50, rangePosition: 50, avgVolume20: 1e6, volumeRatio: 2,
};
const fund = {
  pe: '12.00', forwardPe: '14.00', peg: '2.50', ps: '-', epsTtm: '3.10', epsNextY: '-4.00%',
  salesQoQ: '25.00%', epsQoQ: '5.00%', profitMargin: '30.00%', roe: '150.00%', debtEq: '2.00',
  dividend: '-', shortFloat: '12.00%', beta: '1.00', analystRecom: 1.8, targetPrice: 130, targetUpside: 30,
} as Fundamentals;

const byKey = (f: Fundamentals | null, t = tech) => Object.fromEntries(evaluateMetrics(quote, t, f).map((m) => [m.key, m]));

test('parses Finviz strings', () => {
  assert.equal(num('11.72%'), 11.72);
  assert.equal(num('-0.50'), -0.5);
  assert.equal(num('1,234.5'), 1234.5);
  assert.equal(num('-'), null);
  assert.equal(num(null), null);
  assert.equal(dividendYield('1.06 (0.31%)'), 0.31);
  assert.equal(dividendYield('-'), null);
});

test('rates each metric against its thresholds', () => {
  const m = byKey(fund);
  assert.equal(m.pe.rating, 'good');
  assert.match(m.forwardPe.comment, /이익 감소/);
  assert.equal(m.peg.rating, 'bad');
  assert.equal(m.ps, undefined, 'missing values are skipped');
  assert.equal(m.epsNextY.rating, 'bad');
  assert.equal(m.salesQoQ.rating, 'good');
  assert.equal(m.epsQoQ.rating, 'neutral');
  assert.equal(m.margin.rating, 'good');
  assert.equal(m.roe.rating, 'good');
  assert.match(m.roe.comment, /부풀려/);
  assert.equal(m.debtEq.rating, 'bad');
  assert.equal(m.shortFloat.rating, 'bad');
  assert.equal(m.recom.rating, 'good');
  assert.equal(m.target.rating, 'good');
  assert.equal(m.rsi.rating, 'bad');
  assert.equal(m.sma20.rating, 'good');
  assert.equal(m.sma50.rating, 'bad');
  assert.equal(m.sma200, undefined);
  assert.equal(m.volatility.rating, 'bad');
  assert.equal(m.volume.rating, 'good', 'heavy volume on an up day');
  assert.equal(m.dividend.value, '없음', "Finviz shows '-' for non-payers");
});

test('losses and missing fundamentals', () => {
  const m = byKey({ ...fund, pe: '-', epsTtm: '-2.00', profitMargin: '-8.00%', dividend: '0.00 (0.00%)' });
  assert.equal(m.pe.value, '적자');
  assert.equal(m.pe.rating, 'bad');
  assert.equal(m.eps.rating, 'bad');
  assert.equal(m.margin.rating, 'bad');
  assert.equal(m.dividend.value, '없음');

  const techOnly = evaluateMetrics(quote, tech, null);
  assert.ok(techOnly.length > 0);
  assert.ok(techOnly.every((x) => x.group === '기술적 흐름' || x.group === '위험·수급'));
});
