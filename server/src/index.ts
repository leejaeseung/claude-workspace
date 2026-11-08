import { createServer, type ServerResponse } from 'node:http';

import { analyze, TICKER_RE } from './analyze.ts';
import { NotUsStockError, search, TickerNotFoundError } from './sources/yahoo.ts';
import type { Analysis } from './types.ts';

const PORT = Number(process.env.PORT ?? 8787);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 10 * 60_000);

const cache = new Map<string, { at: number; data: Analysis }>();
const inflight = new Map<string, Promise<Analysis>>();

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function getAnalysis(ticker: string, refresh: boolean): Promise<Analysis> {
  const hit = cache.get(ticker);
  if (hit && !refresh && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  // Coalesce concurrent requests for the same ticker into one crawl.
  let p = inflight.get(ticker);
  if (!p) {
    p = analyze(ticker)
      .then((data) => {
        cache.set(ticker, { at: Date.now(), data });
        return data;
      })
      .finally(() => inflight.delete(ticker));
    inflight.set(ticker, p);
  }
  return p;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const started = Date.now();
  res.on('finish', () => console.log(`${req.method} ${url.pathname}${url.search} ${res.statusCode} ${Date.now() - started}ms`));

  if (req.method === 'OPTIONS') return send(res, 204, null);
  if (req.method !== 'GET') return send(res, 405, { error: '지원하지 않는 메서드입니다.' });

  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true });

    if (url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) return send(res, 200, { results: [] });
      return send(res, 200, { results: await search(q.slice(0, 50)) });
    }

    const m = url.pathname.match(/^\/api\/analyze\/([^/]+)$/);
    if (m) {
      const ticker = decodeURIComponent(m[1]).trim().toUpperCase();
      if (!TICKER_RE.test(ticker)) return send(res, 400, { error: '올바른 티커 형식이 아닙니다. 예: AAPL, MSFT, BRK-B' });
      return send(res, 200, await getAnalysis(ticker, url.searchParams.get('refresh') === '1'));
    }

    return send(res, 404, { error: '없는 경로입니다.' });
  } catch (e) {
    if (e instanceof TickerNotFoundError) return send(res, 404, { error: '해당 티커를 찾을 수 없습니다.' });
    if (e instanceof NotUsStockError) return send(res, 422, { error: '미국 거래소(NYSE·NASDAQ 등)에 상장된 종목만 지원합니다.' });
    console.error(e);
    return send(res, 502, { error: '데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`stock-app server listening on http://0.0.0.0:${PORT}`));
