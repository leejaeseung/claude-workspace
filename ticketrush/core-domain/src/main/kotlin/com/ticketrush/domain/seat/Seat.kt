package com.ticketrush.domain.seat

data class Seat(
    val id: Long,
    val showId: Long,
    val seatNumber: String,
    val status: SeatStatus,
)
