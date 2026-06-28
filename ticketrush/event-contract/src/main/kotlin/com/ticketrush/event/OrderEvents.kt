package com.ticketrush.event

import java.time.Instant

data class OrderCreatedEvent(
    val orderId: Long,
    val userId: String,
    val seatId: Long,
    val showId: Long,
    val totalAmount: Long,
    val timestamp: Instant = Instant.now(),
)

data class OrderExpiredEvent(
    val orderId: Long,
    val timestamp: Instant = Instant.now(),
)
