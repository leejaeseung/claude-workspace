import Constants from "expo-constants";

/**
 * 개발 중에는 app.json > expo.extra.apiBaseUrl 또는 EXPO_PUBLIC_API_BASE_URL 환경변수로 재정의.
 * 기본값은 로컬 백엔드(같은 네트워크의 개발 머신)를 가정한다.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(response.status, body || response.statusText);
  }
  return (await response.json()) as T;
}
