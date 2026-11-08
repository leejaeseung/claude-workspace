export const usd = (x: number) =>
  `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const signedPct = (x: number | null | undefined, digits = 2) =>
  x == null ? '-' : `${x >= 0 ? '+' : ''}${x.toFixed(digits)}%`;

export const signed = (x: number, digits = 2) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`;

export function compact(x: number | null | undefined): string {
  if (x == null) return '-';
  const abs = Math.abs(x);
  if (abs >= 1e9) return `${(x / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
  return x.toFixed(0);
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export const DIRECTION_LABEL = { up: '상승', neutral: '보합', down: '하락' } as const;
export const CONFIDENCE_LABEL = { low: '낮음', medium: '보통', high: '높음' } as const;
