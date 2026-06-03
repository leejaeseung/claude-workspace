import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { PaymentPage } from '../PaymentPage'

// usePaymentStatus 훅을 mock하여 orderId 폴링 로직을 제어
vi.mock('../../hooks/usePaymentStatus', () => ({
  usePaymentStatus: vi.fn(() => ({ data: null })),
}))

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

function renderPaymentPage(overrides?: {
  orderId?: number
  seatId?: number
  userId?: string
  onSuccess?: (seatId: number) => void
  onTimeout?: () => void
}) {
  return render(
    <PaymentPage
      orderId={overrides?.orderId ?? 1}
      seatId={overrides?.seatId ?? 5}
      userId={overrides?.userId ?? 'u1'}
      onSuccess={overrides?.onSuccess ?? vi.fn()}
      onTimeout={overrides?.onTimeout ?? vi.fn()}
    />,
    { wrapper: makeWrapper() }
  )
}

describe('PaymentPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // crypto.randomUUID mock (JSDOM에서 사용 가능하지만 테스트 안정성을 위해 고정값 반환)
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('test-uuid-1234-5678-abcd-ef0123456789')
  })

  describe('초기 렌더링', () => {
    it('"결제" 제목을 표시한다', () => {
      renderPaymentPage()
      expect(screen.getByText('결제')).toBeInTheDocument()
    })

    it('주문 번호를 표시한다', () => {
      renderPaymentPage({ orderId: 42 })
      expect(screen.getByText('#42')).toBeInTheDocument()
    })

    it('좌석 번호를 표시한다', () => {
      renderPaymentPage({ seatId: 7 })
      expect(screen.getByText('7번')).toBeInTheDocument()
    })

    it('결제 금액 100,000원을 표시한다', () => {
      renderPaymentPage()
      expect(screen.getByText('100,000원')).toBeInTheDocument()
    })

    it('"결제하기" 버튼을 표시한다', () => {
      renderPaymentPage()
      expect(screen.getByRole('button', { name: '결제하기' })).toBeInTheDocument()
    })

    it('5분 카운트다운 타이머를 표시한다 (초기값 05:00)', () => {
      renderPaymentPage()
      expect(screen.getByText('05:00')).toBeInTheDocument()
    })

    it('idempotency-key 안내 문구를 표시한다', () => {
      renderPaymentPage()
      expect(screen.getByText(/idempotency-key/)).toBeInTheDocument()
    })
  })

  describe('"결제하기" 버튼 동작', () => {
    it('클릭 시 /payments로 POST 요청을 보낸다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ paymentId: 10, status: 'COMPLETED' }), { status: 200 })
      )

      renderPaymentPage({ orderId: 1, seatId: 5, userId: 'u1' })
      await userEvent.click(screen.getByRole('button', { name: '결제하기' }))

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/payments',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"orderId":1'),
          })
        )
      })
    })

    it('요청 본문에 idempotency-key가 포함된다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ paymentId: 10, status: 'COMPLETED' }), { status: 200 })
      )

      renderPaymentPage()
      await userEvent.click(screen.getByRole('button', { name: '결제하기' }))

      await waitFor(() => {
        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.idempotencyKey).toBe('test-uuid-1234-5678-abcd-ef0123456789')
      })
    })

    it('409 응답 시 "이미 처리된 결제입니다" 에러 메시지를 표시한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Conflict', { status: 409 })
      )

      renderPaymentPage()
      await userEvent.click(screen.getByRole('button', { name: '결제하기' }))

      await waitFor(() => {
        expect(screen.getByText('이미 처리된 결제입니다')).toBeInTheDocument()
      })
    })

    it('비정상 응답 시 "결제에 실패했습니다" 에러 메시지를 표시한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 })
      )

      renderPaymentPage()
      await userEvent.click(screen.getByRole('button', { name: '결제하기' }))

      await waitFor(() => {
        expect(screen.getByText('결제에 실패했습니다')).toBeInTheDocument()
      })
    })
  })

  describe('폴링 후 주문 상태 처리', () => {
    it('CONFIRMED 상태 수신 시 onSuccess를 seatId와 함께 호출한다', async () => {
      const { usePaymentStatus } = await import('../../hooks/usePaymentStatus')
      vi.mocked(usePaymentStatus).mockReturnValue({
        data: { id: 1, status: 'CONFIRMED', seatId: 5 },
      } as never)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ paymentId: 10, status: 'COMPLETED' }), { status: 200 })
      )

      const onSuccess = vi.fn()
      renderPaymentPage({ onSuccess })

      await userEvent.click(screen.getByRole('button', { name: '결제하기' }))

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(5))
    })
  })
})
