package com.ticketrush.event

import java.time.Instant

data class PaymentRequestedEvent(
    val orderId: Long,
    val userId: String,
    val amount: Long,
    val idempotencyKey: String,
    val timestamp: Instant = Instant.now(),
)

data class PaymentConfirmedEvent(
    val orderId: Long,
    val paymentId: Long,
    val seatId: Long,
    val showId: Long,
    val timestamp: Instant = Instant.now(),
)

data class PaymentFailedEvent(
    val orderId: Long,
    val reason: String,
    val timestamp: Instant = Instant.now(),
)
