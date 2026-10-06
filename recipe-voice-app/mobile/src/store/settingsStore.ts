import { create } from "zustand";
import { DEFAULT_WAKE_WORD, getWakeWord, setWakeWord } from "../db/settings";

interface SettingsState {
  wakeWord: string;
  isLoaded: boolean;
  load: () => Promise<void>;
  updateWakeWord: (word: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  wakeWord: DEFAULT_WAKE_WORD,
  isLoaded: false,
  load: async () => {
    const wakeWord = await getWakeWord();
    set({ wakeWord, isLoaded: true });
  },
  updateWakeWord: async (word: string) => {
    const trimmed = word.trim();
    if (trimmed.length === 0) return;
    await setWakeWord(trimmed);
    set({ wakeWord: trimmed });
  },
}));
