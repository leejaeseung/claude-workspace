import type { Technicals } from '../types.ts';

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out; // out[j] corresponds to values[period - 1 + j]
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

export function macd(values: number[]): { macd: number; signal: number; hist: number; prevHist: number | null } | null {
  const e12 = emaSeries(values, 12);
  const e26 = emaSeries(values, 26);
  if (!e26.length) return null;
  // Align: e12[j] ↔ values[11 + j], e26[j] ↔ values[25 + j].
  const line = e26.map((v, j) => e12[j + 14] - v);
  const sig = emaSeries(line, 9);
  if (!sig.length) return null;
  const last = line.at(-1)!;
  const s = sig.at(-1)!;
  const prevHist = sig.length > 1 ? line.at(-2)! - sig.at(-2)! : null;
  return { macd: last, signal: s, hist: last - s, prevHist };
}

function pctChange(values: number[], bars: number): number | null {
  if (values.length <= bars) return null;
  const from = values[values.length - 1 - bars];
  return from ? ((values.at(-1)! - from) / from) * 100 : null;
}

export function computeTechnicals(
  closes: number[],
  volumes: number[],
  high52: number | null,
  low52: number | null,
): Technicals & { macdPrevHist: number | null } {
  const m = macd(closes);
  const last = closes.at(-1) ?? null;

  const rets: number[] = [];
  const start = Math.max(1, closes.length - 60);
  for (let i = start; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(rets.length - 1, 1);

  const avgVol = sma(volumes.slice(0, -1), 20);
  const lastVol = volumes.at(-1) ?? null;

  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes, 14),
    macd: m?.macd ?? null,
    macdSignal: m?.signal ?? null,
    macdHist: m?.hist ?? null,
    macdPrevHist: m?.prevHist ?? null,
    return1w: pctChange(closes, 5),
    return1m: pctChange(closes, 21),
    return3m: pctChange(closes, 63),
    return6m: pctChange(closes, 126),
    return1y: closes.length > 1 ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100 : null,
    volatility: rets.length > 10 ? Math.sqrt(variance) * Math.sqrt(252) * 100 : null,
    rangePosition:
      last != null && high52 != null && low52 != null && high52 > low52
        ? ((last - low52) / (high52 - low52)) * 100
        : null,
    avgVolume20: avgVol,
    volumeRatio: avgVol && lastVol ? lastVol / avgVol : null,
  };
}
