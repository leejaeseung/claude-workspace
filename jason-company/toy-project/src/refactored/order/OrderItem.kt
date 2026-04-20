package com.jasoncompany.refactored.order

/**
 * 주문 상품 Value Object
 *
 * [이준혁 리팩토링 노트]
 * 레거시: Map<String, Any> 남용 → Primitive Obsession Anti-pattern
 * 개선: 타입 안전한 Value Object로 교체
 *
 * 불변(immutable) 설계로 동시성 문제 방지
 */
data class OrderItem(
    val itemId: String,
    val quantity: Int,
    val unitPrice: Double
) {
    init {
        require(quantity > 0) { "수량은 1 이상이어야 합니다: $quantity" }
        require(unitPrice >= 0) { "단가는 0 이상이어야 합니다: $unitPrice" }
    }

    val subtotal: Double get() = unitPrice * quantity
}

/**
 * 주문 결과 Value Object
 *
 * 레거시: Map<String, Any> 반환 → 컴파일 타임 타입 검증 불가
 * 개선: sealed class로 성공/실패 명시적 분기
 */
sealed class OrderResult {
    data class Success(
        val orderId: String,
        val finalPrice: Double,
        val status: String,
        val paymentTransactionId: String
    ) : OrderResult()

    data class Failure(
        val errorCode: ErrorCode,
        val message: String
    ) : OrderResult()
}

enum class ErrorCode {
    INSUFFICIENT_STOCK,
    INVALID_COUPON,
    PAYMENT_FAILED,
    INVALID_PAYMENT_METHOD,
    MINIMUM_ORDER_NOT_MET,
    INVALID_ORDER_STATE,
    ORDER_NOT_FOUND,
    UNAUTHORIZED
}
