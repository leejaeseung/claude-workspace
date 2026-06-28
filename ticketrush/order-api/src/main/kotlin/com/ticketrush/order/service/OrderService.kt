package com.ticketrush.order.service

import arrow.core.Either
import arrow.core.left
import arrow.core.right
import arrow.core.raise.either
import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.domain.error.DomainError
import com.ticketrush.domain.order.Order
import com.ticketrush.domain.order.OrderStatus
import com.ticketrush.event.OrderCreatedEvent
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.entity.OutboxEntity
import com.ticketrush.order.repository.OrderRepository
import com.ticketrush.order.repository.OutboxRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val outboxRepository: OutboxRepository,
    private val objectMapper: ObjectMapper,
) {
    // 티켓 가격 (실제로는 show 서비스에서 조회, 지금은 고정)
    private val TICKET_PRICE = 100_000L

    @Transactional
    fun createOrder(userId: String, seatId: Long, showId: Long): Either<DomainError, Order> =
        either {
            // Arrow-kt Either 기반 검증
            validateUserId(userId).bind()
            validateSeatId(seatId).bind()

            val entity = OrderEntity(
                userId = userId,
                seatId = seatId,
                showId = showId,
                totalAmount = TICKET_PRICE,
                status = OrderEntity.OrderStatus.PENDING,
            )
            val saved = orderRepository.save(entity)

            // Outbox 패턴: 주문 생성 이벤트를 DB에 먼저 저장 (트랜잭션 내)
            val event = OrderCreatedEvent(
                orderId = saved.id,
                userId = userId,
                seatId = seatId,
                showId = showId,
                totalAmount = TICKET_PRICE,
            )
            outboxRepository.save(
                OutboxEntity(
                    aggregateType = "Order",
                    aggregateId = saved.id.toString(),
                    eventType = "OrderCreated",
                    payload = objectMapper.writeValueAsString(event),
                )
            )

            Order(
                id = saved.id,
                userId = userId,
                seatId = seatId,
                showId = showId,
                totalAmount = TICKET_PRICE,
                status = OrderStatus.PENDING,
            )
        }

    @Transactional(readOnly = true)
    fun getOrder(orderId: Long): Either<DomainError, Order> {
        val entity = orderRepository.findById(orderId).orElse(null)
            ?: return DomainError.OrderNotFound(orderId).left()

        return Order(
            id = entity.id,
            userId = entity.userId,
            seatId = entity.seatId,
            showId = entity.showId,
            totalAmount = entity.totalAmount,
            status = OrderStatus.valueOf(entity.status.name),
        ).right()
    }

    private fun validateUserId(userId: String): Either<DomainError, Unit> =
        if (userId.isNotBlank()) Unit.right()
        else DomainError.UnauthorizedAccess(userId).left()

    private fun validateSeatId(seatId: Long): Either<DomainError, Unit> =
        if (seatId > 0) Unit.right()
        else DomainError.SeatNotFound(seatId).left()
}
