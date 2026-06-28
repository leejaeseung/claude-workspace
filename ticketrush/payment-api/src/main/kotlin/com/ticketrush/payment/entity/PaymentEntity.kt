package com.ticketrush.payment.entity

import com.ticketrush.infra.jpa.BaseEntity
import jakarta.persistence.*

@Entity
@Table(name = "payments")
class PaymentEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val orderId: Long,

    @Column(nullable = false)
    val amount: Long,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    var status: PaymentStatus = PaymentStatus.PENDING,

    @Column(nullable = false, unique = true)
    val idempotencyKey: String,
) : BaseEntity() {
    enum class PaymentStatus { PENDING, COMPLETED, FAILED }
}
