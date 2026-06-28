import { useQuery } from '@tanstack/react-query'
import { SeatStatus } from './useSeatSSE'

interface SeatInfo {
  seatId: number
  seatNumber: string
  status: SeatStatus
}

async function fetchSeatList(showId: number): Promise<SeatInfo[]> {
  const res = await fetch(`/seats?showId=${showId}`)
  if (!res.ok) throw new Error('좌석 목록 조회 실패')
  return res.json()
}

export function useSeatList(showId: number) {
  return useQuery({
    queryKey: ['seat-list', showId],
    queryFn: () => fetchSeatList(showId),
    staleTime: 30_000,  // 30초 캐시 (SSE가 실시간 업데이트 담당)
  })
}
