import { useMutation } from '@tanstack/react-query'
import { useSeatSSE, SeatStatus } from '../hooks/useSeatSSE'
import { useSeatList } from '../hooks/useSeatList'
import { useState } from 'react'

const SHOW_ID = 1
const TOTAL_SEATS = 100

async function lockSeat(seatId: number, userId: string) {
  const res = await fetch(`/seats/${seatId}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, showId: SHOW_ID }),
  })
  if (res.status === 409) throw new Error('이미 점유된 좌석입니다')
  if (!res.ok) throw new Error('좌석 점유 실패')
  return res.json()
}

async function createOrder(userId: string, seatId: number, showId: number) {
  const res = await fetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, seatId, showId }),
  })
  if (!res.ok) throw new Error('주문 생성 실패')
  const data = await res.json() as { id: number; status: string }
  return { orderId: data.id, status: data.status }
}

const statusColor: Record<SeatStatus, string> = {
  AVAILABLE: 'bg-gray-700 hover:bg-gray-600 cursor-pointer',
  LOCKED: 'bg-yellow-700 cursor-not-allowed opacity-60',
  CONFIRMED: 'bg-red-900 cursor-not-allowed opacity-50',
}

export function SeatSelectPage({
  userId,
  onSelected,
}: {
  userId: string
  onSelected: (seatId: number, orderId: number) => void
}) {
  const seatUpdates = useSeatSSE(SHOW_ID)
  const { data: initialSeats, isLoading: seatsLoading } = useSeatList(SHOW_ID)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (seatId: number) => {
      await lockSeat(seatId, userId)
      const { orderId } = await createOrder(userId, seatId, SHOW_ID)
      return { seatId, orderId }
    },
    onSuccess: ({ seatId, orderId }) => onSelected(seatId, orderId),
    onError: (e: Error) => setError(e.message),
  })

  const getStatus = (seatId: number): SeatStatus => {
    // SSE 업데이트가 있으면 SSE 우선
    if (seatUpdates.has(seatId)) return seatUpdates.get(seatId)!
    // 없으면 초기 로드 데이터 사용
    const initial = initialSeats?.find(s => s.seatId === seatId)
    return initial?.status ?? 'AVAILABLE'
  }

  if (seatsLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        좌석 정보를 불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
      <h2 className="text-2xl font-bold">좌석 선택</h2>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <div className="grid grid-cols-10 gap-2 w-full">
        {Array.from({ length: TOTAL_SEATS }, (_, i) => i + 1).map((seatId) => {
          const status = getStatus(seatId)
          return (
            <button
              key={seatId}
              disabled={status !== 'AVAILABLE'}
              onClick={() => {
                setSelectedSeat(seatId)
                setError(null)
                mutation.mutate(seatId)
              }}
              className={`
                h-10 w-full rounded text-xs font-mono transition-colors
                ${statusColor[status]}
                ${selectedSeat === seatId ? 'ring-2 ring-blue-400' : ''}
              `}
            >
              {seatId}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700 inline-block" /> 예매 가능</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-700 inline-block" /> 점유 중</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block" /> 완료</span>
      </div>
    </div>
  )
}
