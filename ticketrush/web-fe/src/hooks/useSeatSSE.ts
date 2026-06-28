import { useEffect, useState } from 'react'

export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'CONFIRMED'

export interface SeatState {
  seatId: number
  status: SeatStatus
}

const MAX_ATTEMPTS = 10
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000

export function useSeatSSE(showId: number) {
  const [seatUpdates, setSeatUpdates] = useState<Map<number, SeatStatus>>(new Map())

  useEffect(() => {
    if (!showId) return

    let es: EventSource | null = null
    let attempts = 0
    let timerId: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return

      es = new EventSource(`/sse/seats/${showId}`)

      es.onopen = () => {
        attempts = 0
      }

      es.addEventListener('seat.changed', (e) => {
        const event = JSON.parse(e.data) as { seatId: number; status: SeatStatus }
        setSeatUpdates((prev) => new Map(prev).set(event.seatId, event.status))
      })

      es.onerror = () => {
        es?.close()
        es = null

        if (destroyed) return
        if (attempts >= MAX_ATTEMPTS) return

        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS)
        attempts += 1
        timerId = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      destroyed = true
      if (timerId !== null) clearTimeout(timerId)
      es?.close()
    }
  }, [showId])

  return seatUpdates
}
