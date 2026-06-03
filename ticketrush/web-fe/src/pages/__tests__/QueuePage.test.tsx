import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { QueuePage } from '../QueuePage'
import { useQueueStore } from '../../store/queueStore'

// useQueueSSE는 EventSource를 직접 사용하므로 모듈 수준에서 mock 처리
vi.mock('../../hooks/useQueueSSE', () => ({ useQueueSSE: vi.fn() }))

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

function renderQueuePage(onEntered = vi.fn()) {
  return render(<QueuePage onEntered={onEntered} />, { wrapper: makeWrapper() })
}

describe('QueuePage', () => {
  beforeEach(() => {
    useQueueStore.getState().clearQueue()
    vi.restoreAllMocks()
  })

  describe('대기열 미참여 상태', () => {
    it('"대기열 참여" 버튼을 표시한다', () => {
      renderQueuePage()
      expect(screen.getByRole('button', { name: '대기열 참여' })).toBeInTheDocument()
    })

    it('TicketRush 공연 제목을 표시한다', () => {
      renderQueuePage()
      expect(screen.getByText(/TicketRush/)).toBeInTheDocument()
    })

    it('"대기열 참여" 버튼 클릭 시 /queue/enter로 POST 요청을 보낸다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ position: 5, estimatedWaitSeconds: 30 }), { status: 200 })
      )

      renderQueuePage()
      await userEvent.click(screen.getByRole('button', { name: '대기열 참여' }))

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/queue/enter',
          expect.objectContaining({ method: 'POST' })
        )
      })
    })
  })

  describe('대기열 대기 중 상태 (position > 1)', () => {
    beforeEach(() => {
      useQueueStore.getState().setQueueEntry(10, 60)
    })

    it('현재 대기 순번을 표시한다', () => {
      renderQueuePage()
      expect(screen.getByText('10번')).toBeInTheDocument()
    })

    it('예상 대기시간을 분 단위로 표시한다', () => {
      renderQueuePage()
      expect(screen.getByText(/1분/)).toBeInTheDocument()
    })

    it('"대기 중..." 텍스트를 표시한다', () => {
      renderQueuePage()
      expect(screen.getByText('대기 중...')).toBeInTheDocument()
    })
  })

  describe('입장 가능 상태 (position=1)', () => {
    beforeEach(() => {
      useQueueStore.getState().setQueueEntry(1, 0)
    })

    it('"입장 가능합니다!" 메시지를 표시한다', () => {
      renderQueuePage()
      expect(screen.getByText('입장 가능합니다!')).toBeInTheDocument()
    })

    it('"좌석 선택하기" 버튼을 표시한다', () => {
      renderQueuePage()
      expect(screen.getByRole('button', { name: '좌석 선택하기' })).toBeInTheDocument()
    })

    it('"좌석 선택하기" 버튼 클릭 시 /queue/admit/:userId로 POST 요청을 보낸다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'tok-123', expiresAt: '2026-06-03T12:00:00Z' }), { status: 200 })
      )

      const onEntered = vi.fn()
      renderQueuePage(onEntered)
      await userEvent.click(screen.getByRole('button', { name: '좌석 선택하기' }))

      await waitFor(() => {
        const admitCall = fetchSpy.mock.calls.find(
          (c) => typeof c[0] === 'string' && c[0].includes('/queue/admit/')
        )
        expect(admitCall).toBeDefined()
      })
    })

    it('admit 성공 시 onEntered 콜백을 호출한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'tok-123', expiresAt: '2026-06-03T12:00:00Z' }), { status: 200 })
      )

      const onEntered = vi.fn()
      renderQueuePage(onEntered)
      await userEvent.click(screen.getByRole('button', { name: '좌석 선택하기' }))

      await waitFor(() => expect(onEntered).toHaveBeenCalledTimes(1))
    })
  })
})
