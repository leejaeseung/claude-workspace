import { createServer, type ServerResponse } from 'node:http';

import { fileURLToPath } from 'node:url';

import { analyze, TICKER_RE } from './analyze.ts';
import { Recommender } from './recommend.ts';
import { ReportStore, summarize } from './reports.ts';
import { search } from './sources/yahoo.ts';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_FILE = process.env.DATA_FILE ?? fileURLToPath(new URL('../data/reports.json', import.meta.url));

// Saved reports older than this are collected again automatically (0 turns it off).
const AUTO_REFRESH_HOURS = Number(process.env.AUTO_REFRESH_HOURS ?? 6);
const AUTO_REFRESH_CHECK_MS = 10 * 60_000;
// How often the "rising outlook" ranking is rebuilt (0 = only on request).
const RECOMMEND_HOURS = Number(process.env.RECOMMEND_HOURS ?? 12);
const RECOMMEND_FILE = process.env.RECOMMEND_FILE ?? fileURLToPath(new URL('../data/recommendations.json', import.meta.url));
const HOUR = 3_600_000;

const reports = new ReportStore(DATA_FILE, analyze);
const recommender = new Recommender(
  RECOMMEND_FILE,
  async (ticker) => {
    // Reuse a recent full report instead of crawling the same ticker twice; skip translation for the rest.
    const a = reports.get(ticker)?.analysis;
    if (a && Date.now() - Date.parse(a.generatedAt) < 6 * HOUR) return a;
    return analyze(ticker, { translate: false });
  },
  () => reports.list().map((r) => r.ticker),
);

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body === null ? undefined : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const started = Date.now();
  res.on('finish', () => console.log(`${req.method} ${url.pathname}${url.search} ${res.statusCode} ${Date.now() - started}ms`));

  if (req.method === 'OPTIONS') return send(res, 204, null);

  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) return send(res, 200, { results: [] });
      return send(res, 200, { results: await search(q.slice(0, 50)) });
    }

    if (url.pathname === '/api/reports') {
      if (req.method === 'GET') return send(res, 200, { reports: reports.list(), autoRefreshHours: AUTO_REFRESH_HOURS });
      if (req.method === 'POST') return send(res, 202, { queued: reports.refreshAll(), reports: reports.list() });
      return send(res, 405, { error: '지원하지 않는 메서드입니다.' });
    }

    if (url.pathname === '/api/recommendations') {
      if (req.method === 'GET') return send(res, 200, recommender.get());
      if (req.method === 'POST') {
        recommender.scan().catch((e) => console.error('recommend: scan crashed', e));
        return send(res, 202, recommender.get());
      }
      return send(res, 405, { error: '지원하지 않는 메서드입니다.' });
    }

    const m = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (m) {
      const ticker = decodeURIComponent(m[1]).trim().toUpperCase();
      if (!TICKER_RE.test(ticker)) return send(res, 400, { error: '올바른 티커 형식이 아닙니다. 예: AAPL, MSFT, BRK-B' });
      if (req.method === 'POST') return send(res, 202, summarize(reports.request(ticker)));
      if (req.method === 'GET') {
        const r = reports.get(ticker);
        return r ? send(res, 200, r) : send(res, 404, { error: '아직 분석을 요청하지 않은 종목입니다.' });
      }
      if (req.method === 'DELETE') return reports.remove(ticker) ? send(res, 204, null) : send(res, 404, { error: '없는 종목입니다.' });
      return send(res, 405, { error: '지원하지 않는 메서드입니다.' });
    }

    return send(res, 404, { error: '없는 경로입니다.' });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: '데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

await reports.load();
await recommender.load();
const tick = () => {
  if (AUTO_REFRESH_HOURS > 0) {
    const queued = reports.refreshStale(AUTO_REFRESH_HOURS * HOUR);
    if (queued.length) console.log(`auto-refresh: ${queued.join(', ')}`);
  }
  if (RECOMMEND_HOURS > 0 && recommender.isStale(RECOMMEND_HOURS * HOUR)) {
    recommender.scan().catch((e) => console.error('recommend: scan crashed', e));
  }
};
tick();
setInterval(tick, AUTO_REFRESH_CHECK_MS).unref();
server.listen(PORT, '0.0.0.0', () => console.log(`stock-app server listening on http://0.0.0.0:${PORT}`));
