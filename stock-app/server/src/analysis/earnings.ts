// The latest quarterly report: Finviz's surprise/growth numbers plus how the share price reacted,
// measured from the daily chart.

import type { EarningsInfo, Fundamentals, PricePoint } from '../types.ts';
import { num } from './metrics.ts';

const DAY_MS = 86_400_000;
const ymd = (t: number) => new Date(t * 1000).toISOString().slice(0, 10); // bars are stamped at the US open, so UTC date = NY date

/** Index of the first bar that reflects the report: the report day itself before the open, else the next session. */
function reactionIndex(points: PricePoint[], date: string, timing: EarningsInfo['timing']): number {
  return points.findIndex((p) => (timing === 'BMO' ? ymd(p.t) >= date : ymd(p.t) > date));
}

/**
 * When the next report is already announced, Finviz no longer shows the last one's date. Reports are
 * roughly quarterly and draw the heaviest trading of the quarter, so take the busiest session in a
 * window around three months before the next date.
 */
function estimateLastReport(points: PricePoint[], volumes: number[], next: string): number {
  const nextMs = Date.parse(`${next}T00:00:00Z`);
  let best = -1;
  points.forEach((p, i) => {
    const age = (nextMs - p.t * 1000) / DAY_MS;
    if (age >= 70 && age <= 110 && i > 0 && (best < 0 || volumes[i] > volumes[best])) best = i;
  });
  return best;
}

export function buildEarnings(
  f: Fundamentals | null,
  points: PricePoint[],
  volumes: number[],
  now = new Date(),
): EarningsInfo | null {
  if (!f) return null;
  const timing = /\bBMO\b/.test(f.earningsDate ?? '') ? 'BMO' : /\bAMC\b/.test(f.earningsDate ?? '') ? 'AMC' : null;
  const date = f.earningsAt ?? null;
  const today = now.toISOString().slice(0, 10);
  const upcoming = date != null && (date > today || (date === today && timing !== 'BMO'));

  let idx = -1;
  let lastDate: string | null = null;
  let lastDateEstimated = false;
  if (date && !upcoming) {
    lastDate = date;
    idx = reactionIndex(points, date, timing);
  } else if (date && upcoming) {
    idx = estimateLastReport(points, volumes, date);
    if (idx > 0) {
      lastDate = ymd(points[idx].t);
      lastDateEstimated = true;
    }
  }

  let reaction: number | null = null;
  let sinceReport: number | null = null;
  if (idx > 0) {
    const before = points[idx - 1].c;
    reaction = (points[idx].c / before - 1) * 100;
    sinceReport = (points.at(-1)!.c / before - 1) * 100;
  }

  const info: EarningsInfo = {
    nextDate: upcoming ? date : null,
    lastDate,
    lastDateEstimated,
    timing,
    epsSurprise: num(f.epsSurprise),
    salesSurprise: num(f.salesSurprise),
    epsGrowth: num(f.epsQoQ),
    salesGrowth: num(f.salesQoQ),
    reaction,
    sinceReport,
  };
  const empty = Object.entries(info).every(([k, v]) => v == null || k === 'lastDateEstimated');
  return empty ? null : info;
}

/** Days from the last report to `now`, or null when unknown. */
export function daysSinceReport(e: EarningsInfo, now = Date.now()): number | null {
  return e.lastDate ? Math.floor((now - Date.parse(`${e.lastDate}T00:00:00Z`)) / DAY_MS) : null;
}

/** Days until the announced next report, or null. */
export function daysToNextReport(e: EarningsInfo, now = Date.now()): number | null {
  return e.nextDate ? Math.ceil((Date.parse(`${e.nextDate}T00:00:00Z`) - now) / DAY_MS) : null;
}
