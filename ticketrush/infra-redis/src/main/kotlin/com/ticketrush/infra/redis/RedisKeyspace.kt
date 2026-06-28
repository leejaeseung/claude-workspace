package com.ticketrush.infra.redis

object RedisKeyspace {
    // 좌석 분산 락: SEAT_LOCK:{showId}:{seatId}
    fun seatLock(showId: Long, seatId: Long) = "SEAT_LOCK:$showId:$seatId"

    // 대기열 Sorted Set: QUEUE:{showId}
    fun queue(showId: Long) = "QUEUE:$showId"

    // 입장 토큰: ENTRY_TOKEN:{userId}:{showId}
    fun entryToken(userId: String, showId: Long) = "ENTRY_TOKEN:$userId:$showId"

    // 결제 멱등성 키: IDEMPOTENCY:{key}
    fun idempotency(key: String) = "IDEMPOTENCY:$key"
}
