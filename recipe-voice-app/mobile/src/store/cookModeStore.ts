import { create } from "zustand";

interface CookModeState {
  currentStepIndex: number;
  timerSecondsLeft: number | null;
  totalSteps: number;
  init: (totalSteps: number) => void;
  next: () => void;
  prev: () => void;
  startTimer: (seconds: number) => void;
  tickTimer: () => void;
  clearTimer: () => void;
}

export const useCookModeStore = create<CookModeState>((set, get) => ({
  currentStepIndex: 0,
  timerSecondsLeft: null,
  totalSteps: 0,
  init: (totalSteps) => set({ currentStepIndex: 0, totalSteps, timerSecondsLeft: null }),
  next: () =>
    set((state) => ({
      currentStepIndex: Math.min(state.currentStepIndex + 1, state.totalSteps - 1),
    })),
  prev: () =>
    set((state) => ({ currentStepIndex: Math.max(state.currentStepIndex - 1, 0) })),
  startTimer: (seconds) => set({ timerSecondsLeft: seconds }),
  tickTimer: () => {
    const { timerSecondsLeft } = get();
    if (timerSecondsLeft === null) return;
    set({ timerSecondsLeft: Math.max(timerSecondsLeft - 1, 0) });
  },
  clearTimer: () => set({ timerSecondsLeft: null }),
}));
