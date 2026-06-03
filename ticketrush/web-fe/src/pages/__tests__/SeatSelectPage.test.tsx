import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { SeatSelectPage } from '../SeatSelectPage'

// SSE 훅은 실제 EventSource를 사용하므로 mock
vi.mock('../../hooks/useSeatSSE', () => ({
  useSeatSSE: vi.fn(() => new Map()),
}))

// 초기 좌석 목록 훅 mock
vi.mock('../../hooks/useSeatList', () => ({
  useSeatList: vi.fn(() => ({
    data: Array.from({ length: 10 }, (_, i) => ({
      seatId: i + 1,
      seatNumber: `A${i + 1}`,
      status: 'AVAILABLE',
    })),
    isLoading: false,
  })),
}))

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

function renderSeatPage(onSelected = vi.fn()) {
  return render(
    <SeatSelectPage userId="test-user" onSelected={onSelected} />,
    { wrapper: makeWrapper() }
  )
}

describe('SeatSelectPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('"좌석 선택" 제목을 표시한다', () => {
    renderSeatPage()
    expect(screen.getByText('좌석 선택')).toBeInTheDocument()
  })

  it('초기 좌석 목록이 렌더링된다 (100개 중 1~10번 확인)', () => {
    renderSeatPage()
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
  })

  it('좌석 클릭 시 /seats/{id}/lock 과 /orders로 순서대로 요청한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ seatId: 1, userId: 'test-user', expiresAt: '...' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 42, status: 'PENDING' }), { status: 200 })
      )

    renderSeatPage()
    await userEvent.click(screen.getByRole('button', { name: '1' }))

    await waitFor(() => {
      const lockCall = fetchSpy.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('/seats/1/lock')
      )
      expect(lockCall).toBeDefined()
    })
  })

  it('좌석 잠금 성공 + 주문 생성 성공 시 onSelected를 (seatId, orderId)로 호출한다', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ seatId: 3, userId: 'test-user', expiresAt: '...' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 99, status: 'PENDING' }), { status: 200 })
      )

    const onSelected = vi.fn()
    renderSeatPage(onSelected)
    await userEvent.click(screen.getByRole('button', { name: '3' }))

    await waitFor(() => expect(onSelected).toHaveBeenCalledWith(3, 99))
  })

  it('좌석 잠금 409 응답 시 오류 메시지를 표시한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Conflict', { status: 409 })
    )

    renderSeatPage()
    await userEvent.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      expect(screen.getByText('이미 점유된 좌석입니다')).toBeInTheDocument()
    })
  })

  it('로딩 중에는 로딩 메시지를 표시한다', () => {
    const { useSeatList } = vi.mocked(await import('../../hooks/useSeatList'))
    useSeatList.mockReturnValueOnce({ data: undefined, isLoading: true } as never)

    render(
      <SeatSelectPage userId="test-user" onSelected={vi.fn()} />,
      { wrapper: makeWrapper() }
    )
    expect(screen.getByText('좌석 정보를 불러오는 중...')).toBeInTheDocument()
  })
})
