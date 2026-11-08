import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'recent-tickers-v1';
const MAX = 12;

export interface RecentItem {
  ticker: string;
  name: string;
}

let memory: RecentItem[] | null = null;
const listeners = new Set<(items: RecentItem[]) => void>();

async function load(): Promise<RecentItem[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    memory = [];
  }
  return memory;
}

function save(items: RecentItem[]) {
  memory = items;
  listeners.forEach((l) => l(items));
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}

export async function addRecent(item: RecentItem) {
  const items = await load();
  save([item, ...items.filter((i) => i.ticker !== item.ticker)].slice(0, MAX));
}

export function useRecent() {
  const [items, setItems] = useState<RecentItem[]>(memory ?? []);
  useEffect(() => {
    listeners.add(setItems);
    load().then(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  const remove = useCallback(async (ticker: string) => {
    save((await load()).filter((i) => i.ticker !== ticker));
  }, []);
  const clear = useCallback(() => save([]), []);
  return { items, remove, clear };
}
