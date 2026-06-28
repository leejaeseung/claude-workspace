import { useEffect } from 'react'
import { useQueueStore } from '../store/queueStore'

interface QueuePositionEvent {
  type: 'queue.position.updated'
  data: {
    userId: string
    showId: number
    position: number
    estimatedWaitSeconds: number
  }
}

export function useQueueSSE(userId: string, showId: number) {
  const setQueueEntry = useQueueStore((s) => s.setQueueEntry)

  useEffect(() => {
    if (!userId || !showId) return

    const es = new EventSource(`/sse/queue/${userId}?showId=${showId}`)

    es.addEventListener('queue.position.updated', (e) => {
      const event: QueuePositionEvent = JSON.parse(e.data)
      setQueueEntry(event.data.position, event.data.estimatedWaitSeconds)
    })

    es.onerror = () => es.close()

    return () => es.close()
  }, [userId, showId, setQueueEntry])
}
