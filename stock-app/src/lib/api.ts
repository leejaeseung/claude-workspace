import { Platform } from 'react-native';

import type { Portfolio, Recommendations, Report, ReportSummary, SearchResult } from './types';

// Android emulators reach the host machine at 10.0.2.2. On a real phone set
// EXPO_PUBLIC_API_URL in .env to your computer's LAN address (see .env.example).
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL).replace(/\/+$/, '');

export class ApiError extends Error {}

export class NotFoundError extends ApiError {}

async function call<T>(
  path: string,
  { method = 'GET', signal, body }: { method?: string; signal?: AbortSignal; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    // Skips the interstitial page tunnels like ngrok can show; other hosts ignore the header.
    const headers: Record<string, string> = { 'ngrok-skip-browser-warning': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    res = await fetch(`${API_URL}${path}`, { method, signal, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError(`서버(${API_URL})에 연결할 수 없습니다. 서버가 실행 중인지, 주소가 맞는지 확인해 주세요.`);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    const msg = data?.error ?? `요청에 실패했습니다 (${res.status}).`;
    throw res.status === 404 ? new NotFoundError(msg) : new ApiError(msg);
  }
  return data;
}

const reportPath = (ticker: string) => `/api/reports/${encodeURIComponent(ticker)}`;

/** Asks the server to (re)collect a ticker in the background; returns right away. */
export function requestReport(ticker: string) {
  return call<ReportSummary>(reportPath(ticker), { method: 'POST' });
}

export function fetchReport(ticker: string, signal?: AbortSignal) {
  return call<Report>(reportPath(ticker), { signal });
}

export function deleteReport(ticker: string) {
  return call<void>(reportPath(ticker), { method: 'DELETE' });
}

export async function listReports(signal?: AbortSignal) {
  return (await call<{ reports: ReportSummary[] }>('/api/reports', { signal })).reports;
}

/** Queues a re-collection of every saved ticker. */
export async function refreshAllReports() {
  return call<{ queued: number; reports: ReportSummary[] }>('/api/reports', { method: 'POST' });
}

export function fetchRecommendations(signal?: AbortSignal) {
  return call<Recommendations>('/api/recommendations', { signal });
}

/** Starts a new ranking scan in the background (joins the running one if any). */
export function rescanRecommendations() {
  return call<Recommendations>('/api/recommendations', { method: 'POST' });
}

export function fetchPortfolio(signal?: AbortSignal) {
  return call<Portfolio>('/api/paper', { signal });
}

/** Starts a new paper portfolio with `amount` USD, replacing any existing one. */
export function startPortfolio(amount: number) {
  return call<Portfolio>('/api/paper', { method: 'POST', body: { amount } });
}

export function stopPortfolio() {
  return call<void>('/api/paper', { method: 'DELETE' });
}

export async function searchTickers(q: string, signal?: AbortSignal) {
  return (await call<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, { signal })).results;
}
