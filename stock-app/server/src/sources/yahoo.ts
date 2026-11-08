import { XMLParser } from 'fast-xml-parser';

import { fetchJson, fetchText, UpstreamError } from '../http.ts';
import type { PricePoint, Quote, SearchResult } from '../types.ts';

// Yahoo exchange codes for US listings (NASDAQ tiers, NYSE, NYSE American, NYSE Arca, Cboe BZX, OTC excluded).
export const US_EXCHANGES = new Set(['NMS', 'NGM', 'NCM', 'NAS', 'NYQ', 'NYS', 'ASE', 'PCX', 'BTS', 'NIM', 'CXI']);

export class NotUsStockError extends Error {}
export class TickerNotFoundError extends Error {}

interface ChartResponse {
  chart: {
    result:
      | {
          meta: {
            symbol: string;
            longName?: string;
            shortName?: string;
            exchangeName: string;
            fullExchangeName?: string;
            currency: string;
            instrumentType?: string;
            regularMarketPrice: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
            regularMarketTime: number;
          };
          timestamp?: number[];
          indicators: { quote: { close: (number | null)[]; volume: (number | null)[] }[] };
        }[]
      | null;
    error: { code: string; description: string } | null;
  };
}

export interface History {
  quote: Quote;
  points: PricePoint[];
  volumes: number[];
}

export async function getHistory(ticker: string): Promise<History> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includePrePost=false`;
  let data: ChartResponse;
  try {
    data = await fetchJson<ChartResponse>(url);
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) throw new TickerNotFoundError(ticker);
    throw e;
  }
  const r = data.chart.result?.[0];
  if (!r) throw new TickerNotFoundError(ticker);
  const m = r.meta;
  if (!US_EXCHANGES.has(m.exchangeName) || m.currency !== 'USD') {
    throw new NotUsStockError(`${ticker} is listed on ${m.fullExchangeName ?? m.exchangeName}`);
  }

  const ts = r.timestamp ?? [];
  const closes = r.indicators.quote[0]?.close ?? [];
  const vols = r.indicators.quote[0]?.volume ?? [];
  const points: PricePoint[] = [];
  const volumes: number[] = [];
  ts.forEach((t, i) => {
    const c = closes[i];
    if (c == null) return;
    points.push({ t, c });
    volumes.push(vols[i] ?? 0);
  });

  // The 1y chart's chartPreviousClose is the close a year ago, so take the prior bar instead.
  const last = points.at(-1);
  const lastIsToday = last && Math.abs(last.t - m.regularMarketTime) < 86_400;
  const prev = lastIsToday ? points.at(-2)?.c : last?.c;
  const previousClose = m.previousClose ?? prev ?? m.chartPreviousClose ?? m.regularMarketPrice;
  const change = m.regularMarketPrice - previousClose;

  return {
    quote: {
      ticker: m.symbol,
      name: m.longName ?? m.shortName ?? m.symbol,
      exchange: m.fullExchangeName ?? m.exchangeName,
      currency: m.currency,
      price: m.regularMarketPrice,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : 0,
      previousClose,
      dayHigh: m.regularMarketDayHigh ?? null,
      dayLow: m.regularMarketDayLow ?? null,
      volume: m.regularMarketVolume ?? null,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? null,
      marketTime: new Date(m.regularMarketTime * 1000).toISOString(),
    },
    points,
    volumes,
  };
}

interface SearchResponse {
  quotes: { symbol: string; shortname?: string; longname?: string; exchange?: string; exchDisp?: string; quoteType?: string }[];
}

export async function search(q: string): Promise<SearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`;
  const data = await fetchJson<SearchResponse>(url);
  return data.quotes
    .filter((x) => x.exchange && US_EXCHANGES.has(x.exchange) && (x.quoteType === 'EQUITY' || x.quoteType === 'ETF'))
    .map((x) => ({
      ticker: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchDisp ?? x.exchange ?? '',
      type: x.quoteType ?? '',
    }));
}

export interface RawNews {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

const xml = new XMLParser({ ignoreAttributes: false });

type RssItem = { title?: unknown; link?: unknown; pubDate?: unknown; source?: unknown };

export function parseRss(text: string, defaultSource: string): RawNews[] {
  const doc = xml.parse(text) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const raw = doc.rss?.channel?.item;
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return items.flatMap((it) => {
    const title = String(it.title ?? '').trim();
    const link = String(it.link ?? '').trim();
    if (!title || !link) return [];
    const src = it.source;
    const source =
      typeof src === 'string' ? src : src && typeof src === 'object' && '#text' in src ? String(src['#text']) : defaultSource;
    const d = it.pubDate ? new Date(String(it.pubDate)) : null;
    return [{ title, url: link, source, publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : null }];
  });
}

export async function getYahooNews(ticker: string): Promise<RawNews[]> {
  const text = await fetchText(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
  );
  return parseRss(text, 'Yahoo Finance');
}
