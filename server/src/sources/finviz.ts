import * as cheerio from 'cheerio';

import { fetchText } from '../http.ts';
import type { Fundamentals } from '../types.ts';
import type { RawNews } from './yahoo.ts';

export interface FinvizData {
  fundamentals: Fundamentals;
  news: RawNews[];
}

function num(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[,%]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Finviz news dates look like "Nov-07-26 12:01PM", or just "09:15AM" for later items on the same day.
// Times are US Eastern; we approximate with a fixed -05:00 offset, which is close enough for sorting.
function parseNewsDates(cells: string[]): (string | null)[] {
  let day: string | null = null;
  return cells.map((raw) => {
    const s = raw.trim();
    const full = s.match(/^([A-Z][a-z]{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(AM|PM)$/);
    const timeOnly = s.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
    const today = s.match(/^Today\s+(\d{1,2}):(\d{2})(AM|PM)$/);
    let h: number, mi: string, ap: string;
    if (full) {
      const [, mon, dd, yy] = full;
      const mm = String('JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(mon) / 3 + 1).padStart(2, '0');
      day = `20${yy}-${mm}-${dd}`;
      [h, mi, ap] = [Number(full[4]), full[5], full[6]];
    } else if (today) {
      day = new Date().toISOString().slice(0, 10);
      [h, mi, ap] = [Number(today[1]), today[2], today[3]];
    } else if (timeOnly && day) {
      [h, mi, ap] = [Number(timeOnly[1]), timeOnly[2], timeOnly[3]];
    } else {
      return null;
    }
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const d = new Date(`${day}T${String(h).padStart(2, '0')}:${mi}:00-05:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  });
}

export async function getFinviz(ticker: string): Promise<FinvizData> {
  const html = await fetchText(`https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}&p=d`);
  const $ = cheerio.load(html);

  const snap = new Map<string, string>();
  $('td.snapshot-td2').each((_, el) => {
    const label = $(el).find('.snapshot-td-label');
    if (!label.length) return;
    const key = label.text().trim();
    const value = $(el).next('td').text().trim();
    // "EPS next Y" appears twice (absolute value, then growth %). Keep both.
    if (snap.has(key)) snap.set(`${key}#2`, value);
    else snap.set(key, value);
  });
  const get = (k: string) => {
    const v = snap.get(k);
    return v && v !== '-' ? v : null;
  };

  const cat = (prefix: string) => {
    const a = $(`.quote-header_categories a[href*="f=${prefix}_"]`).first();
    return a.length ? a.text().trim() : null;
  };

  const price = num(get('Price'));
  const target = num(get('Target Price'));

  const fundamentals: Fundamentals = {
    sector: cat('sec'),
    industry: cat('industry') ?? cat('ind'),
    country: cat('geo'),
    marketCap: get('Market Cap'),
    pe: get('P/E'),
    forwardPe: get('Forward P/E'),
    peg: get('PEG'),
    ps: get('P/S'),
    epsTtm: get('EPS (ttm)'),
    epsNextY: get('EPS next Y#2') ?? get('EPS next Y'),
    salesQoQ: get('Sales Q/Q'),
    epsQoQ: get('EPS Q/Q'),
    profitMargin: get('Profit Margin'),
    roe: get('ROE'),
    debtEq: get('Debt/Eq'),
    dividend: get('Dividend TTM') ?? get('Dividend %'),
    shortFloat: get('Short Float'),
    beta: get('Beta'),
    earningsDate: get('Earnings'),
    earningsAt: parseEarningsDate(get('Earnings')),
    analystRecom: num(get('Recom')),
    targetPrice: target,
    targetUpside: price && target ? ((target - price) / price) * 100 : null,
  };

  const rows = $('#news-table tr').toArray();
  const dates = parseNewsDates(rows.map((r) => $(r).find('td').first().text()));
  const news: RawNews[] = rows.flatMap((r, i) => {
    const a = $(r).find('a.tab-link-news').first();
    const title = a.text().trim();
    const url = a.attr('href');
    if (!title || !url) return [];
    const source = $(r).find('.news-link-right span').first().text().replace(/[()]/g, '').trim() || 'Finviz';
    return [{ title, url: url.startsWith('/') ? `https://finviz.com${url}` : url, source, publishedAt: dates[i] }];
  });

  return { fundamentals, news };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Finviz shows the earnings date without a year ("Nov 17 AMC"). It is either the next report or the
 * one just past, so pick the year that puts it closest to `now`. Returns YYYY-MM-DD.
 */
export function parseEarningsDate(raw: string | null, now = new Date()): string | null {
  const m = raw?.match(/^([A-Za-z]{3})\s+(\d{1,2})\b/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  const day = Number(m[2]);
  const year = now.getUTCFullYear();
  const best = [year - 1, year, year + 1]
    .map((y) => Date.UTC(y, month, day))
    .reduce((a, b) => (Math.abs(b - now.getTime()) < Math.abs(a - now.getTime()) ? b : a));
  return new Date(best).toISOString().slice(0, 10);
}
