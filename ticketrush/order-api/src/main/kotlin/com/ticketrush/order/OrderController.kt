package com.ticketrush.order

import arrow.core.Either
import com.ticketrush.domain.error.DomainError
import com.ticketrush.order.service.OrderService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/orders")
class OrderController(
    private val orderService: OrderService,
) {
    data class CreateOrderRequest(val userId: String, val seatId: Long, val showId: Long)
    data class OrderResponse(
        val id: Long, val userId: String, val seatId: Long,
        val showId: Long, val status: String, val totalAmount: Long,
    )
    data class ErrorResponse(val type: String, val detail: String)

    @PostMapping
    fun create(@RequestBody request: CreateOrderRequest): ResponseEntity<Any> =
        when (val result = orderService.createOrder(request.userId, request.seatId, request.showId)) {
            is Either.Right -> ResponseEntity.status(HttpStatus.CREATED).body(result.value.toResponse())
            is Either.Left -> ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(
                ErrorResponse("order-creation-failed", result.value.message)
            )
        }

    @GetMapping("/{orderId}")
    fun get(@PathVariable orderId: Long): ResponseEntity<Any> =
        when (val result = orderService.getOrder(orderId)) {
            is Either.Right -> ResponseEntity.ok(result.value.toResponse())
            is Either.Left -> ResponseEntity.notFound().build()
        }

    private fun com.ticketrush.domain.order.Order.toResponse() =
        OrderResponse(id, userId, seatId, showId, status.name, totalAmount)
}
