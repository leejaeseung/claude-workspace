package com.ticketrush.domain.seat

import java.time.Instant

data class SeatLock(
    val seatId: Long,
    val userId: String,
    val lockedAt: Instant,
    val expiresAt: Instant,
)
