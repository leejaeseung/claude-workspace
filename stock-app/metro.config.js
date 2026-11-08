// Development only: Metro forwards /api/* and /health to the analysis server, so a phone that can
// reach the dev server (LAN or `expo start --tunnel`) can reach the API through the same address.
// Point the app at it with EXPO_PUBLIC_API_URL=<the dev server's https URL>.
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const target = new URL(process.env.API_PROXY_TARGET || 'http://127.0.0.1:8787');

function proxy(req, res) {
  const upstream = http.request(
    { host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...req.headers, host: target.host } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '분석 서버가 실행 중이 아닙니다.' }));
  });
  req.pipe(upstream);
}

const prevEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = prevEnhance ? prevEnhance(middleware, server) : middleware;
    return (req, res, next) =>
      req.url && (req.url.startsWith('/api/') || req.url === '/health') ? proxy(req, res) : base(req, res, next);
  },
};

module.exports = config;
