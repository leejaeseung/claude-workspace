import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseEarningsDate } from './sources/finviz.ts';

test('parseEarningsDate picks the year closest to now', () => {
  const now = new Date('2026-11-08T00:00:00Z');
  assert.equal(parseEarningsDate('Nov 17 AMC', now), '2026-11-17');
  assert.equal(parseEarningsDate('Oct 21 AMC', now), '2026-10-21', 'a report just past');
  assert.equal(parseEarningsDate('Jan 29 BMO', now), '2027-01-29', 'next year');
  assert.equal(parseEarningsDate('Dec 30', new Date('2027-01-05T00:00:00Z')), '2026-12-30', 'last year');
  assert.equal(parseEarningsDate(null, now), null);
  assert.equal(parseEarningsDate('-', now), null);
});
