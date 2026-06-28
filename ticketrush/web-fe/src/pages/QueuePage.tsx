import { useMutation } from '@tanstack/react-query'
import { useQueueStore } from '../store/queueStore'
import { useQueueSSE } from '../hooks/useQueueSSE'
import { useState } from 'react'

const SHOW_ID = 1

async function enterQueue(userId: string) {
  const res = await fetch('/queue/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, showId: SHOW_ID }),
  })
  if (!res.ok) throw new Error('대기열 진입 실패')
  return res.json() as Promise<{ position: number; estimatedWaitSeconds: number }>
}

async function admitUser(userId: string) {
  const res = await fetch(`/queue/admit/${userId}?showId=${SHOW_ID}`, { method: 'POST' })
  if (!res.ok) throw new Error('입장 처리 실패')
  return res.json() as Promise<{ token: string; expiresAt: string }>
}

export function QueuePage({ onEntered }: { onEntered: () => void }) {
  const [userId] = useState(() => `user-${Math.random().toString(36).slice(2, 8)}`)
  const { position, estimatedWaitSeconds, isInQueue, setQueueEntry } = useQueueStore()
  const [admitError, setAdmitError] = useState<string | null>(null)

  useQueueSSE(userId, SHOW_ID)

  const mutation = useMutation({
    mutationFn: () => enterQueue(userId),
    onSuccess: (data) => setQueueEntry(data.position, data.estimatedWaitSeconds),
  })

  const admitMutation = useMutation({
    mutationFn: () => admitUser(userId),
    onSuccess: () => onEntered(),
    onError: (e: Error) => setAdmitError(e.message),
  })

  if (isInQueue && position === 1) {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-green-400 text-xl font-bold">입장 가능합니다!</p>
        {admitError && <p className="text-red-400 text-sm">{admitError}</p>}
        <button
          onClick={() => admitMutation.mutate()}
          disabled={admitMutation.isPending}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
        >
          {admitMutation.isPending ? '처리 중...' : '좌석 선택하기'}
        </button>
      </div>
    )
  }

  if (isInQueue) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-300 text-lg">대기 중...</p>
        <p className="text-4xl font-bold text-yellow-400">{position}번</p>
        <p className="text-gray-500 text-sm">
          예상 대기시간: 약 {Math.ceil((estimatedWaitSeconds ?? 0) / 60)}분
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold">TicketRush — 공연 #1</h2>
      <p className="text-gray-400">대기열에 참여하여 티켓을 예매하세요</p>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        {mutation.isPending ? '참여 중...' : '대기열 참여'}
      </button>
    </div>
  )
}
