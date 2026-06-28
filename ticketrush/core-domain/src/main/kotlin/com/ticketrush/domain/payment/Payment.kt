package com.ticketrush.domain.payment

data class Payment(
    val id: Long,
    val orderId: Long,
    val amount: Long,
    val status: PaymentStatus,
    val idempotencyKey: String,
)
