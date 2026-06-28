package com.ticketrush.payment.repository

import com.ticketrush.payment.entity.PaymentEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface PaymentRepository : JpaRepository<PaymentEntity, Long> {
    fun findByIdempotencyKey(idempotencyKey: String): Optional<PaymentEntity>
    fun existsByIdempotencyKey(idempotencyKey: String): Boolean
}
