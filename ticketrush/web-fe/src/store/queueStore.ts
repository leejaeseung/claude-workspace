import { create } from 'zustand'

interface QueueState {
  position: number | null
  estimatedWaitSeconds: number | null
  isInQueue: boolean
  setQueueEntry: (position: number, estimatedWaitSeconds: number) => void
  clearQueue: () => void
}

export const useQueueStore = create<QueueState>((set) => ({
  position: null,
  estimatedWaitSeconds: null,
  isInQueue: false,
  setQueueEntry: (position, estimatedWaitSeconds) =>
    set({ position, estimatedWaitSeconds, isInQueue: true }),
  clearQueue: () =>
    set({ position: null, estimatedWaitSeconds: null, isInQueue: false }),
}))
