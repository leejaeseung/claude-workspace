import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQueueSSE } from '../useQueueSSE'
import { useQueueStore } from '../../store/queueStore'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onerror: (() => void) | null = null
  private listeners: Map<string, ((e: MessageEvent) => void)[]> = new Map()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    const existing = this.listeners.get(type) ?? []
    this.listeners.set(type, [...existing, handler])
  }

  dispatch(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) })
    this.listeners.get(type)?.forEach((h) => h(event))
  }

  simulateError() { this.onerror?.() }

  close = vi.fn()
}

describe('useQueueSSE', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
    useQueueStore.getState().clearQueue()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('올바른 SSE URL에 연결한다', () => {
    renderHook(() => useQueueSSE('user-42', 1))
    expect(MockEventSource.instances[0].url).toBe('/sse/queue/user-42?showId=1')
  })

  it('userId나 showId가 빈 값이면 EventSource를 생성하지 않는다', () => {
    renderHook(() => useQueueSSE('', 1))
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('queue.position.updated 이벤트 — queueStore의 position과 estimatedWaitSeconds를 갱신한다', () => {
    renderHook(() => useQueueSSE('user-1', 1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.dispatch('queue.position.updated', {
        type: 'queue.position.updated',
        data: { userId: 'user-1', showId: 1, position: 5, estimatedWaitSeconds: 30 },
      })
    })

    const state = useQueueStore.getState()
    expect(state.position).toBe(5)
    expect(state.estimatedWaitSeconds).toBe(30)
    expect(state.isInQueue).toBe(true)
  })

  it('위치가 1로 업데이트되면 입장 가능 상태로 전환된다', () => {
    renderHook(() => useQueueSSE('user-1', 1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.dispatch('queue.position.updated', {
        type: 'queue.position.updated',
        data: { userId: 'user-1', showId: 1, position: 1, estimatedWaitSeconds: 0 },
      })
    })

    expect(useQueueStore.getState().position).toBe(1)
  })

  it('오류 발생 시 EventSource를 닫는다', () => {
    renderHook(() => useQueueSSE('user-1', 1))
    const es = MockEventSource.instances[0]

    act(() => { es.simulateError() })

    expect(es.close).toHaveBeenCalled()
  })

  it('컴포넌트 언마운트 시 EventSource를 닫는다', () => {
    const { unmount } = renderHook(() => useQueueSSE('user-1', 1))
    const es = MockEventSource.instances[0]

    unmount()

    expect(es.close).toHaveBeenCalled()
  })
})
