package com.ticketrush.event

import java.time.Instant

data class SeatChangedEvent(
    val seatId: Long,
    val showId: Long,
    val status: String,  // AVAILABLE | LOCKED | CONFIRMED
    val timestamp: Instant = Instant.now(),
)
