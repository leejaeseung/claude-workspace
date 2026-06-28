package com.ticketrush.order.repository

import com.ticketrush.order.entity.OrderEntity
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class PendingOrderQueryRepository(private val em: EntityManager) {

    fun findExpiredPendingOrders(before: Instant): List<OrderEntity> =
        em.createQuery(
            "SELECT o FROM OrderEntity o WHERE o.status = :status AND o.createdAt < :before",
            OrderEntity::class.java,
        )
            .setParameter("status", OrderEntity.OrderStatus.PENDING)
            .setParameter("before", before)
            .resultList
}
