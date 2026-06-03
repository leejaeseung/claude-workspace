import { describe, it, expect, beforeEach } from 'vitest'
import { useQueueStore } from '../queueStore'

describe('queueStore', () => {
  beforeEach(() => {
    useQueueStore.getState().clearQueue()
  })

  it('초기 상태 — position=null, isInQueue=false', () => {
    const state = useQueueStore.getState()
    expect(state.position).toBeNull()
    expect(state.estimatedWaitSeconds).toBeNull()
    expect(state.isInQueue).toBe(false)
  })

  it('setQueueEntry — position과 estimatedWaitSeconds를 설정하고 isInQueue=true로 변경한다', () => {
    useQueueStore.getState().setQueueEntry(5, 30)
    const state = useQueueStore.getState()
    expect(state.position).toBe(5)
    expect(state.estimatedWaitSeconds).toBe(30)
    expect(state.isInQueue).toBe(true)
  })

  it('setQueueEntry 두 번 호출 — 최신 값으로 덮어쓴다', () => {
    useQueueStore.getState().setQueueEntry(10, 60)
    useQueueStore.getState().setQueueEntry(3, 18)
    const state = useQueueStore.getState()
    expect(state.position).toBe(3)
    expect(state.estimatedWaitSeconds).toBe(18)
  })

  it('clearQueue — 모든 상태를 초기화한다', () => {
    useQueueStore.getState().setQueueEntry(7, 42)
    useQueueStore.getState().clearQueue()
    const state = useQueueStore.getState()
    expect(state.position).toBeNull()
    expect(state.estimatedWaitSeconds).toBeNull()
    expect(state.isInQueue).toBe(false)
  })

  it('position=1은 입장 가능 조건이다', () => {
    useQueueStore.getState().setQueueEntry(1, 0)
    const state = useQueueStore.getState()
    expect(state.isInQueue).toBe(true)
    expect(state.position).toBe(1)
  })
})
