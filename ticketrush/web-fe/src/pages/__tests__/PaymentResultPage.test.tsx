import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentResultPage } from '../PaymentResultPage'

describe('PaymentResultPage', () => {

  describe('결제 성공 상태 (success=true)', () => {
    it('예매 완료 메시지를 표시한다', () => {
      render(<PaymentResultPage success={true} seatId={42} onRetry={vi.fn()} />)
      expect(screen.getByText('예매 완료!')).toBeInTheDocument()
    })

    it('좌석 번호를 표시한다', () => {
      render(<PaymentResultPage success={true} seatId={42} onRetry={vi.fn()} />)
      expect(screen.getByText(/42번/)).toBeInTheDocument()
    })

    it('"다시 예매하기" 버튼을 표시한다', () => {
      render(<PaymentResultPage success={true} seatId={42} onRetry={vi.fn()} />)
      expect(screen.getByRole('button', { name: '다시 예매하기' })).toBeInTheDocument()
    })

    it('"다시 예매하기" 버튼 클릭 시 onRetry를 호출한다', async () => {
      const onRetry = vi.fn()
      render(<PaymentResultPage success={true} seatId={42} onRetry={onRetry} />)

      await userEvent.click(screen.getByRole('button', { name: '다시 예매하기' }))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('결제 실패 상태 (success=false)', () => {
    it('결제 실패 메시지를 표시한다', () => {
      render(<PaymentResultPage success={false} seatId={null} onRetry={vi.fn()} />)
      expect(screen.getByText('결제 실패 또는 시간 초과')).toBeInTheDocument()
    })

    it('좌석 잠금 해제 안내 문구를 표시한다', () => {
      render(<PaymentResultPage success={false} seatId={null} onRetry={vi.fn()} />)
      expect(screen.getByText('좌석 잠금이 해제되었습니다')).toBeInTheDocument()
    })

    it('"다시 시도하기" 버튼을 표시한다', () => {
      render(<PaymentResultPage success={false} seatId={null} onRetry={vi.fn()} />)
      expect(screen.getByRole('button', { name: '다시 시도하기' })).toBeInTheDocument()
    })

    it('"다시 시도하기" 버튼 클릭 시 onRetry를 호출한다', async () => {
      const onRetry = vi.fn()
      render(<PaymentResultPage success={false} seatId={null} onRetry={onRetry} />)

      await userEvent.click(screen.getByRole('button', { name: '다시 시도하기' }))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })
})
