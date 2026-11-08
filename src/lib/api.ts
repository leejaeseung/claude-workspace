import { Platform } from 'react-native';

import type { Analysis, SearchResult } from './types';

// Android emulators reach the host machine at 10.0.2.2. On a real phone set
// EXPO_PUBLIC_API_URL in .env to your computer's LAN address (see .env.example).
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL).replace(/\/+$/, '');

export class ApiError extends Error {}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError(`서버(${API_URL})에 연결할 수 없습니다. 서버가 실행 중인지, 주소가 맞는지 확인해 주세요.`);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `요청에 실패했습니다 (${res.status}).`);
  return body;
}

export function fetchAnalysis(ticker: string, refresh = false, signal?: AbortSignal) {
  return get<Analysis>(`/api/analyze/${encodeURIComponent(ticker)}${refresh ? '?refresh=1' : ''}`, signal);
}

export async function searchTickers(q: string, signal?: AbortSignal) {
  return (await get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal)).results;
}
