import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { usePaymentStatus } from '../usePaymentStatus'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('usePaymentStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('enabled=false이면 fetch를 호출하지 않는다', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderHook(() => usePaymentStatus(1, false), { wrapper: makeWrapper() })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('orderId=null이면 fetch를 호출하지 않는다', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderHook(() => usePaymentStatus(null, true), { wrapper: makeWrapper() })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('enabled=true이고 orderId가 있으면 /orders/:id를 fetch한다', async () => {
    const mockData = { id: 10, status: 'PENDING', seatId: 5 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    )

    const { result } = renderHook(() => usePaymentStatus(10, true), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('PENDING')
    expect(result.current.data?.seatId).toBe(5)
  })

  it('CONFIRMED 상태 — refetchInterval이 false를 반환해 폴링을 중단한다', async () => {
    const mockData = { id: 10, status: 'CONFIRMED', seatId: 5 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 })
    )

    const { result } = renderHook(() => usePaymentStatus(10, true), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // CONFIRMED는 terminal 상태 → refetchInterval 로직이 false를 반환해야 한다
    expect(result.current.data?.status).toBe('CONFIRMED')
    // 두 번째 fetch 호출이 없어야 한다 (폴링 중단 확인은 mock 호출 횟수로)
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(1)
  })

  it('EXPIRED 상태 — 데이터를 정상적으로 반환한다', async () => {
    const mockData = { id: 10, status: 'EXPIRED', seatId: 5 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    )

    const { result } = renderHook(() => usePaymentStatus(10, true), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('EXPIRED')
  })

  it('fetch가 non-200 상태를 반환하면 error 상태가 된다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    )

    const { result } = renderHook(() => usePaymentStatus(10, true), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
