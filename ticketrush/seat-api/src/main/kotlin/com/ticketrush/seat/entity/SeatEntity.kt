package com.ticketrush.seat.entity

import com.ticketrush.infra.jpa.BaseEntity
import jakarta.persistence.*

@Entity
@Table(name = "seats")
class SeatEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val showId: Long,

    @Column(nullable = false)
    val seatNumber: String,

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    var status: SeatStatus = SeatStatus.AVAILABLE,

    /** 주문 생성 시 연결된 orderId. 결제 확정/만료/실패 이벤트 역추적에 사용 */
    @Column(nullable = true)
    var orderId: Long? = null,

    @Version
    val version: Long = 0,
) : BaseEntity() {
    enum class SeatStatus { AVAILABLE, LOCKED, CONFIRMED, CANCELLED }
}
