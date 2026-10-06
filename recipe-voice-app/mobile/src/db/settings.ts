import { getDb } from "./schema";

export const DEFAULT_WAKE_WORD = "셰프야";
const WAKE_WORD_KEY = "wake_word";

export async function getWakeWord(): Promise<string> {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [WAKE_WORD_KEY]
  );
  return row?.value ?? DEFAULT_WAKE_WORD;
}

export async function setWakeWord(word: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [WAKE_WORD_KEY, word]
  );
}
