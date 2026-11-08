import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { deleteReport, listReports, requestReport } from './api';
import type { ReportStatus, ReportSummary } from './types';

export const POLL_MS = 3000;

export const isPending = (s: ReportStatus) => s === 'queued' || s === 'running';

// One shared copy of the server's report list, so every screen sees the same state.
let current: ReportSummary[] = [];
let loaded = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshReports() {
  try {
    current = await listReports();
    lastError = null;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }
  loaded = true;
  emit();
}

function upsert(r: ReportSummary) {
  current = [r, ...current.filter((x) => x.ticker !== r.ticker)];
  emit();
}

/** Starts a background collection. Throws ApiError if the server rejects it. */
export async function startReport(ticker: string) {
  const r = await requestReport(ticker.trim().toUpperCase());
  upsert(r);
  return r;
}

export async function removeReport(ticker: string) {
  current = current.filter((x) => x.ticker !== ticker);
  emit();
  await deleteReport(ticker).catch(() => {});
  refreshReports();
}

/** The report list; refetched on focus and polled while any job is still collecting. */
export function useReports() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const pending = current.some((r) => isPending(r.status));
  useFocusEffect(
    useCallback(() => {
      refreshReports();
      if (!pending) return;
      const id = setInterval(refreshReports, POLL_MS);
      return () => clearInterval(id);
    }, [pending]),
  );

  return { reports: current, loaded, error: lastError, pending };
}
