import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { usePaymentStatus } from '../hooks/usePaymentStatus'

const PAYMENT_TIMEOUT_SECONDS = 300 // 5분

// showId is hardcoded to 1 for the demo; in production it comes from the routing context
const DEMO_SHOW_ID = 1

interface PaymentPageProps {
  orderId: number
  seatId: number
  userId: string
  onSuccess: (seatId: number) => void
  onTimeout: () => void
}

async function requestPayment(
  orderId: number,
  seatId: number,
  showId: number,
  userId: string,
  idempotencyKey: string,
) {
  const res = await fetch('/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, seatId, showId, userId, idempotencyKey }),
  })
  if (res.status === 409) throw new Error('이미 처리된 결제입니다')
  if (!res.ok) throw new Error('결제에 실패했습니다')
  return res.json() as Promise<{ paymentId: number; status: string }>
}

export function PaymentPage({ orderId, seatId, userId, onSuccess, onTimeout }: PaymentPageProps) {
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT_SECONDS)
  const [error, setError] = useState<string | null>(null)
  const [pollingOrderId, setPollingOrderId] = useState<number | null>(null)

  // 클라이언트 측 idempotency-key — 재시도 시 동일 키 재사용
  const idempotencyKey = useRef(crypto.randomUUID())

  // 5분 카운트다운
  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout()
      return
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft, onTimeout])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isUrgent = secondsLeft <= 60

  const mutation = useMutation({
    mutationFn: () => requestPayment(orderId, seatId, DEMO_SHOW_ID, userId, idempotencyKey.current),
    onSuccess: () => {
      setPollingOrderId(orderId)  // 폴링 시작
    },
    onError: (e: Error) => setError(e.message),
  })

  const { data: orderStatus } = usePaymentStatus(pollingOrderId, pollingOrderId !== null)

  // 폴링 결과 처리
  useEffect(() => {
    if (!orderStatus) return
    if (orderStatus.status === 'CONFIRMED') {
      onSuccess(orderStatus.seatId)
    } else if (orderStatus.status === 'EXPIRED' || orderStatus.status === 'CANCELLED') {
      setError('결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
      setPollingOrderId(null)
    }
  }, [orderStatus, onSuccess])

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <h2 className="text-2xl font-bold">결제</h2>

      {/* 카운트다운 타이머 */}
      <div className={`text-5xl font-mono font-bold tabular-nums ${isUrgent ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <p className={`text-sm ${isUrgent ? 'text-red-400' : 'text-gray-500'}`}>
        {isUrgent ? '⚠️ 곧 만료됩니다!' : '결제 가능 시간'}
      </p>

      {/* 주문 정보 */}
      <div className="w-full border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">주문 번호</span>
          <span>#{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">좌석</span>
          <span>{seatId}번</span>
        </div>
        <div className="flex justify-between font-bold text-base mt-2">
          <span>결제 금액</span>
          <span>100,000원</span>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={() => {
          setError(null)
          mutation.mutate()
        }}
        disabled={mutation.isPending || pollingOrderId !== null || secondsLeft <= 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        {mutation.isPending ? '결제 중...' : '결제하기'}
      </button>

      {pollingOrderId !== null && orderStatus?.status === 'PENDING' && (
        <p className="text-sm text-yellow-400 animate-pulse">결제 처리 중... 잠시만 기다려주세요</p>
      )}

      <p className="text-xs text-gray-700">
        결제 실패 시 재시도해도 중복 결제되지 않습니다 (idempotency-key 적용)
      </p>
    </div>
  )
}
