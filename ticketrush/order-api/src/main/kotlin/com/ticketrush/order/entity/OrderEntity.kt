package com.ticketrush.order.entity

import com.ticketrush.infra.jpa.BaseEntity
import jakarta.persistence.*

@Entity
@Table(name = "orders")
class OrderEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val userId: String,

    @Column(nullable = false)
    val seatId: Long,

    @Column(nullable = false)
    val showId: Long,

    @Column(nullable = false)
    val totalAmount: Long,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    var status: OrderStatus = OrderStatus.PENDING,
) : BaseEntity() {
    enum class OrderStatus { PENDING, CONFIRMED, EXPIRED, CANCELLED }
}
