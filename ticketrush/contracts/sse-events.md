# SSE 이벤트 정의

SSE 엔드포인트: `GET /sse/seats/{showId}` (notification-api, port 8085)

## seat.changed

좌석 상태 변경 시 발행

```json
{
  "type": "seat.changed",
  "data": {
    "seatId": 123,
    "showId": 1,
    "status": "LOCKED"
  }
}
```

| status | 의미 |
|--------|------|
| AVAILABLE | 예매 가능 |
| LOCKED | 점유 중 (5분 TTL) |
| CONFIRMED | 결제 완료, 확정 |

## queue.position.updated

대기 순번 변경 시 발행

```json
{
  "type": "queue.position.updated",
  "data": {
    "userId": "user-123",
    "showId": 1,
    "position": 42,
    "estimatedWaitSeconds": 210
  }
}
```

## Zod 스키마 (FE)

```ts
import { z } from 'zod'

export const SeatChangedEvent = z.object({
  type: z.literal('seat.changed'),
  data: z.object({
    seatId: z.number(),
    showId: z.number(),
    status: z.enum(['AVAILABLE', 'LOCKED', 'CONFIRMED']),
  }),
})

export const QueuePositionUpdatedEvent = z.object({
  type: z.literal('queue.position.updated'),
  data: z.object({
    userId: z.string(),
    showId: z.number(),
    position: z.number(),
    estimatedWaitSeconds: z.number(),
  }),
})
```
