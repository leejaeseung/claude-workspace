import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useSeatList } from '../useSeatList'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useSeatList', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('/seats?showId={showId} 엔드포인트를 fetch한다', async () => {
    const mockSeats = [
      { seatId: 1, seatNumber: 'A1', status: 'AVAILABLE' },
      { seatId: 2, seatNumber: 'A2', status: 'LOCKED' },
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockSeats), { status: 200 })
    )

    const { result } = renderHook(() => useSeatList(1), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toContain('/seats?showId=1')
    expect(result.current.data).toHaveLength(2)
  })

  it('응답에 AVAILABLE과 LOCKED 상태가 올바르게 포함된다', async () => {
    const mockSeats = [
      { seatId: 5, seatNumber: 'B5', status: 'AVAILABLE' },
      { seatId: 6, seatNumber: 'B6', status: 'CONFIRMED' },
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockSeats), { status: 200 })
    )

    const { result } = renderHook(() => useSeatList(1), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].status).toBe('AVAILABLE')
    expect(result.current.data?.[1].status).toBe('CONFIRMED')
  })

  it('fetch 실패 시 error 상태가 된다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )

    const { result } = renderHook(() => useSeatList(1), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
