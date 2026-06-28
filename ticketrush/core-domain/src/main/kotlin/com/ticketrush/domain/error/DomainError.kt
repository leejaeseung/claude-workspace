package com.ticketrush.domain.error

sealed class DomainError(val message: String) {
    data class SeatAlreadyLocked(val seatId: Long) :
        DomainError("Seat $seatId is already locked")

    data class SeatNotFound(val seatId: Long) :
        DomainError("Seat $seatId not found")

    data class OrderNotFound(val orderId: Long) :
        DomainError("Order $orderId not found")

    data class PaymentAlreadyProcessed(val idempotencyKey: String) :
        DomainError("Payment with idempotency key $idempotencyKey already processed")

    data class InvalidQueuePosition(val userId: String) :
        DomainError("Invalid queue position for user $userId")

    data class UnauthorizedAccess(val userId: String) :
        DomainError("Unauthorized access by user $userId")

    data class PgUnavailable(val reason: String) :
        DomainError("PG is unavailable: $reason")
}
