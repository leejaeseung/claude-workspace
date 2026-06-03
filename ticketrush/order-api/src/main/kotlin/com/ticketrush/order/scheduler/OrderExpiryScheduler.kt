package com.ticketrush.order.scheduler

import com.fasterxml.jackson.databind.ObjectMapper
import com.ticketrush.event.OrderExpiredEvent
import com.ticketrush.order.entity.OrderEntity
import com.ticketrush.order.entity.OutboxEntity
import com.ticketrush.order.repository.OrderRepository
import com.ticketrush.order.repository.OutboxRepository
import com.ticketrush.order.repository.PendingOrderQueryRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Component
class OrderExpiryScheduler(
    private val orderRepository: OrderRepository,
    private val outboxRepository: OutboxRepository,
    private val pendingOrderRepository: PendingOrderQueryRepository,
    private val objectMapper: ObjectMapper,
) {
    // 10초마다 만료된 PENDING 주문 처리
    @Scheduled(fixedDelay = 10_000)
    @Transactional
    fun expireOrders() {
        val expiredOrders = pendingOrderRepository.findExpiredPendingOrders(
            before = Instant.now().minusSeconds(300) // 5분 초과
        )
        if (expiredOrders.isEmpty()) return

        // N+1 방지: 루프 안 개별 save() → 일괄 수집 후 saveAll() 배치 INSERT
        val outboxEntities = expiredOrders.map { order ->
            order.status = OrderEntity.OrderStatus.EXPIRED
            OutboxEntity(
                aggregateType = "Order",
                aggregateId = order.id.toString(),
                eventType = "OrderExpired",
                payload = objectMapper.writeValueAsString(OrderExpiredEvent(orderId = order.id)),
            )
        }
        outboxRepository.saveAll(outboxEntities)
        orderRepository.saveAll(expiredOrders)
    }
}
