package com.jasoncompany.refactored.order

/**
 * 주문 상태 머신 — State Pattern
 *
 * [박지수 설계 / 이준혁 구현]
 *
 * 레거시 문제:
 * - 상태 전이 규칙이 processOrder(), cancelOrder()에 분산
 * - DELIVERED, REFUNDED 상태 추가 시 전체 if-else 수정 필요
 * - 잘못된 전이(예: CANCELLED → SHIPPING)를 런타임에만 감지
 *
 * 개선:
 * - 각 상태가 허용된 전이만 직접 정의 (OCP 준수)
 * - 잘못된 전이 시 컴파일 타임 오류 유도
 * - 새 상태(REFUNDED 등) 추가 시 기존 코드 수정 없음
 *
 * [이준혁 Strangler Fig 노트]
 * 레거시 LegacyOrderService와 병행 운영.
 * 새 OrderProcessor만 이 StateMachine을 사용.
 * 레거시는 Golden Master 테스트가 통과하는 동안 그대로 유지.
 */

enum class OrderStatus {
    PENDING,    // 주문 생성됨, 결제 대기
    PAID,       // 결제 완료
    SHIPPING,   // 배송 중
    DELIVERED,  // 배송 완료
    CANCELLED,  // 취소됨
    REFUNDED    // 환불 완료
}

/**
 * 주문 상태 머신
 * 허용된 전이만 수행, 불가 전이 시 IllegalStateException
 */
class OrderStateMachine(initialStatus: OrderStatus = OrderStatus.PENDING) {

    var currentStatus: OrderStatus = initialStatus
        private set

    /**
     * 결제 완료 전이: PENDING → PAID
     */
    fun markAsPaid(): OrderStateMachine {
        check(currentStatus == OrderStatus.PENDING) {
            "결제 전이 불가: $currentStatus → PAID (허용: PENDING에서만 가능)"
        }
        currentStatus = OrderStatus.PAID
        return this
    }

    /**
     * 배송 시작 전이: PAID → SHIPPING
     */
    fun markAsShipping(): OrderStateMachine {
        check(currentStatus == OrderStatus.PAID) {
            "배송 시작 불가: $currentStatus → SHIPPING (허용: PAID에서만 가능)"
        }
        currentStatus = OrderStatus.SHIPPING
        return this
    }

    /**
     * 배송 완료 전이: SHIPPING → DELIVERED
     */
    fun markAsDelivered(): OrderStateMachine {
        check(currentStatus == OrderStatus.SHIPPING) {
            "배송 완료 불가: $currentStatus → DELIVERED (허용: SHIPPING에서만 가능)"
        }
        currentStatus = OrderStatus.DELIVERED
        return this
    }

    /**
     * 취소 전이: PENDING, PAID → CANCELLED
     * (SHIPPING 이후에는 취소 불가 — 레거시 동작 보존)
     */
    fun cancel(): OrderStateMachine {
        check(currentStatus == OrderStatus.PENDING || currentStatus == OrderStatus.PAID) {
            "취소 불가: $currentStatus → CANCELLED " +
            "(허용: PENDING, PAID에서만 가능. SHIPPING 이후 취소 불가)"
        }
        currentStatus = OrderStatus.CANCELLED
        return this
    }

    /**
     * 환불 전이: CANCELLED → REFUNDED
     */
    fun markAsRefunded(): OrderStateMachine {
        check(currentStatus == OrderStatus.CANCELLED) {
            "환불 처리 불가: $currentStatus → REFUNDED (허용: CANCELLED에서만 가능)"
        }
        currentStatus = OrderStatus.REFUNDED
        return this
    }

    /**
     * 현재 상태에서 가능한 전이 목록 반환
     * (ARB 의사결정 투명성 지원)
     */
    fun availableTransitions(): List<String> = when (currentStatus) {
        OrderStatus.PENDING    -> listOf("markAsPaid()", "cancel()")
        OrderStatus.PAID       -> listOf("markAsShipping()", "cancel()")
        OrderStatus.SHIPPING   -> listOf("markAsDelivered()")
        OrderStatus.DELIVERED  -> listOf("markAsRefunded() via cancel first")
        OrderStatus.CANCELLED  -> listOf("markAsRefunded()")
        OrderStatus.REFUNDED   -> listOf("(최종 상태 — 추가 전이 없음)")
    }

    override fun toString(): String = "OrderStateMachine(status=$currentStatus)"
}
