package com.ticketrush.order.repository

import com.ticketrush.order.entity.OutboxEntity
import org.springframework.data.jpa.repository.JpaRepository

interface OutboxRepository : JpaRepository<OutboxEntity, Long> {
    fun findAllByPublishedFalse(): List<OutboxEntity>
    fun findAllByPublishedFalseAndRetryCountLessThan(maxRetry: Int): List<OutboxEntity>
}
