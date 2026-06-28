package com.ticketrush.payment

import arrow.core.Either
import com.ticketrush.domain.error.DomainError
import com.ticketrush.payment.service.PaymentService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/payments")
class PaymentController(
    private val paymentService: PaymentService,
) {
    data class PaymentRequest(val orderId: Long, val seatId: Long, val showId: Long, val userId: String, val idempotencyKey: String)
    data class PaymentResponse(val paymentId: Long, val status: String)
    data class ErrorResponse(val type: String, val detail: String)

    @PostMapping
    fun pay(@RequestBody request: PaymentRequest): ResponseEntity<Any> =
        when (val result = paymentService.processPayment(
            request.orderId, request.seatId, request.showId, request.userId, request.idempotencyKey
        )) {
            is Either.Right -> ResponseEntity.ok<Any>(
                PaymentResponse(paymentId = result.value.id, status = result.value.status.name)
            )
            is Either.Left -> when (val err = result.value) {
                is DomainError.PaymentAlreadyProcessed ->
                    ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ErrorResponse("payment-already-processed", err.message)
                    )
                else -> ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(
                    ErrorResponse("payment-failed", err.message)
                )
            }
        }
}
