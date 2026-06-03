import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSeatSSE } from '../useSeatSSE'

// EventSource Mock
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners: Map<string, ((e: MessageEvent) => void)[]> = new Map()
  readyState: number = 0 // CONNECTING

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    const handlers = this.listeners.get(type) ?? []
    this.listeners.set(type, [...handlers, handler])
  }

  dispatchEvent(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) })
    this.listeners.get(type)?.forEach((h) => h(event))
  }

  simulateOpen() {
    this.readyState = 1 // OPEN
    this.onopen?.()
  }

  simulateError() {
    this.readyState = 2 // CLOSED
    this.onerror?.()
  }

  close() {
    this.readyState = 2
  }
}

describe('useSeatSSE', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('showId가 주어지면 올바른 SSE URL에 연결한다', () => {
    renderHook(() => useSeatSSE(99))
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('/sse/seats/99')
  })

  it('showId=0이면 EventSource를 생성하지 않는다', () => {
    renderHook(() => useSeatSSE(0))
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('seat.changed 이벤트 수신 시 seatUpdates Map이 갱신된다', () => {
    const { result } = renderHook(() => useSeatSSE(1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.dispatchEvent('seat.changed', { seatId: 5, status: 'LOCKED' })
    })

    expect(result.current.get(5)).toBe('LOCKED')
  })

  it('여러 seat.changed 이벤트가 누적된다', () => {
    const { result } = renderHook(() => useSeatSSE(1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.dispatchEvent('seat.changed', { seatId: 1, status: 'LOCKED' })
      es.dispatchEvent('seat.changed', { seatId: 2, status: 'CONFIRMED' })
    })

    expect(result.current.get(1)).toBe('LOCKED')
    expect(result.current.get(2)).toBe('CONFIRMED')
  })

  it('같은 seatId에 두 번째 이벤트가 오면 최신 상태로 덮어쓴다', () => {
    const { result } = renderHook(() => useSeatSSE(1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.dispatchEvent('seat.changed', { seatId: 3, status: 'LOCKED' })
    })
    act(() => {
      es.dispatchEvent('seat.changed', { seatId: 3, status: 'AVAILABLE' })
    })

    expect(result.current.get(3)).toBe('AVAILABLE')
  })

  it('연결 오류 발생 시 지수 백오프 후 재연결한다', () => {
    renderHook(() => useSeatSSE(1))
    const firstEs = MockEventSource.instances[0]

    act(() => {
      firstEs.simulateError()
    })

    // 첫 번째 오류: 1000ms 후 재연결
    expect(MockEventSource.instances).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[1].url).toBe('/sse/seats/1')
  })

  it('컴포넌트 언마운트 시 EventSource를 닫는다', () => {
    const { unmount } = renderHook(() => useSeatSSE(1))
    const es = MockEventSource.instances[0]
    const closeSpy = vi.spyOn(es, 'close')

    unmount()

    expect(closeSpy).toHaveBeenCalled()
  })

  it('onopen 이벤트 수신 시 재연결 시도 횟수가 0으로 초기화된다', () => {
    renderHook(() => useSeatSSE(1))
    const es = MockEventSource.instances[0]

    act(() => {
      es.simulateOpen()
      es.simulateError()
    })

    // 재연결 횟수가 0에서 시작하므로 1000ms 후 재연결
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(MockEventSource.instances).toHaveLength(2)
  })
})
