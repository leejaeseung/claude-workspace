import { useQuery } from '@tanstack/react-query'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'

interface OrderStatusResponse {
  id: number
  status: OrderStatus
  seatId: number
}

const TERMINAL_STATUSES: OrderStatus[] = ['CONFIRMED', 'EXPIRED', 'CANCELLED']
const POLL_INTERVAL_MS = 3000
const MAX_POLL_DURATION_MS = 30_000

export function usePaymentStatus(orderId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['order-status', orderId],
    queryFn: async (): Promise<OrderStatusResponse> => {
      const res = await fetch(`/orders/${orderId}`)
      if (!res.ok) throw new Error('주문 상태 조회 실패')
      return res.json()
    },
    enabled: enabled && orderId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && TERMINAL_STATUSES.includes(status)) return false
      return POLL_INTERVAL_MS
    },
    staleTime: 0,
  })
}
