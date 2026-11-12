import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEarnings } from './analysis/earnings.ts';
import { detectEvent, recentEvents } from './analysis/events.ts';
import { buildOutlook } from './analysis/outlook.ts';
import type { Fundamentals, NewsItem, PricePoint, Quote, Technicals } from './types.ts';

const ev = (t: string) => detectEvent(t)?.key ?? null;

test('detectEvent recognises common market-moving headlines', () => {
  assert.equal(ev('Morgan Stanley raises Nvidia price target to $300, keeps Overweight'), 'targetUp');
  assert.equal(ev('Apple price target cut at Jefferies on iPhone worries'), 'targetDown');
  assert.equal(ev('Intel downgraded to Sell at BofA'), 'downgrade');
  assert.equal(ev('AMD upgraded to Buy as AI demand accelerates'), 'upgrade');
  assert.equal(ev('Amgen raises full-year guidance after strong quarter'), 'guidanceUp');
  assert.equal(ev('Nike cuts annual sales outlook as China slows'), 'guidanceDown');
  assert.equal(ev('Microsoft beats estimates on cloud strength'), 'beat');
  assert.equal(ev('Disney quarterly revenue misses expectations'), 'miss');
  assert.equal(ev('FDA approves Lilly obesity pill'), 'approval');
  assert.equal(ev('Tesla faces DOJ probe over Autopilot claims'), 'legal');
  assert.equal(ev('Apple announces $110 billion buyback'), 'buyback');
  assert.equal(ev('Palantir to join the S&P 500'), 'index');
  assert.equal(ev('Lockheed wins $2 billion Pentagon contract'), 'contract');
  assert.equal(ev('Is Nvidia stock a buy right now?'), null);
  assert.equal(ev('Startups target new markets'), null, 'no verb, no event');
});

test('recentEvents weighs fresh events and ignores old ones', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const n = (title: string, daysAgo: number) =>
    ({ title, publishedAt: new Date(now - daysAgo * 86_400_000).toISOString(), event: detectEvent(title) }) as NewsItem;
  const r = recentEvents(
    [n('X upgraded to Buy', 1), n('Analyst raises X price target', 2), n('X raises price target', 3), n('X downgraded', 30)],
    now,
  );
  assert.equal(r.count, 3);
  assert.ok(r.score > 0.4);
  assert.deepEqual(r.byLabel.map((b) => b.label), ['목표가 상향', '투자의견 상향']);
});

// 30 trading-ish days ending 2026-11-09; a jump on the session after an AMC report on 2026-10-29.
const day = (d: string) => Date.parse(`${d}T14:30:00Z`) / 1000;
const points: PricePoint[] = [];
const volumes: number[] = [];
for (let i = 0; i < 30; i++) {
  const t = day('2026-10-10') + i * 86_400;
  const d = new Date(t * 1000).toISOString().slice(0, 10);
  points.push({ t, c: d >= '2026-10-30' ? 110 : 100 });
  volumes.push(d === '2026-10-30' ? 9e6 : 1e6);
}
const f = (earningsDate: string, earningsAt: string) =>
  ({ earningsDate, earningsAt, epsSurprise: '8.00%', salesSurprise: '2.00%', epsQoQ: '30%', salesQoQ: '12%' }) as Fundamentals;

test('buildEarnings measures the reaction after the report', () => {
  const e = buildEarnings(f('Oct 29 AMC', '2026-10-29'), points, volumes, new Date('2026-11-09T20:00:00Z'))!;
  assert.equal(e.lastDate, '2026-10-29');
  assert.equal(e.nextDate, null);
  assert.equal(e.reaction?.toFixed(1), '10.0');
  assert.equal(e.epsSurprise, 8);
  assert.equal(e.salesGrowth, 12);
});

test('buildEarnings estimates the last report from volume when the next date is announced', () => {
  const e = buildEarnings(f('Jan 28 AMC', '2027-01-28'), points, volumes, new Date('2026-11-09T20:00:00Z'))!;
  assert.equal(e.nextDate, '2027-01-28');
  assert.equal(e.lastDate, '2026-10-30');
  assert.equal(e.lastDateEstimated, true);
  assert.equal(e.reaction?.toFixed(1), '10.0');
});

test('a strong report lifts the outlook and an imminent one caps confidence', () => {
  const quote = { price: 110, changePercent: 0 } as Quote;
  const t = { macdPrevHist: null } as unknown as Technicals & { macdPrevHist: number | null };
  const now = Date.parse('2026-11-09T20:00:00Z');
  const e = buildEarnings(f('Oct 29 AMC', '2026-10-29'), points, volumes, new Date(now))!;
  const o = buildOutlook(quote, t, null, [], e, now);
  const keys = o.signals.map((s) => s.key);
  assert.ok(keys.includes('surprise') && keys.includes('reaction') && keys.includes('growth'));
  assert.ok(o.score > 30, `score ${o.score}`);
});

test('only headlines that name the company carry its events', async () => {
  const { companyTerms, mentionsCompany } = await import('./analysis/events.ts');
  const intel = companyTerms('INTC', 'Intel Corporation');
  assert.deepEqual(intel, ['intc', 'intel']);
  assert.equal(mentionsCompany('Intel downgraded to Sell at BofA', intel), true);
  assert.equal(mentionsCompany("Intel's foundry wins Microsoft order", intel), true);
  assert.equal(mentionsCompany('AMD Jumps on Oppenheimer Upgrade', intel), false);
  assert.equal(mentionsCompany('Google Cloud picks new chip', companyTerms('GOOGL', 'Alphabet Inc.')), true);
  assert.equal(ev('A Jensen Huang exit could slow AI dealmaking, Morningstar warns'), 'warning');
});
