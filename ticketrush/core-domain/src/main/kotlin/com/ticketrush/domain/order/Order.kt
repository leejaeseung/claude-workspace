package com.ticketrush.domain.order

data class Order(
    val id: Long,
    val userId: String,
    val seatId: Long,
    val showId: Long,
    val totalAmount: Long,
    val status: OrderStatus,
)
