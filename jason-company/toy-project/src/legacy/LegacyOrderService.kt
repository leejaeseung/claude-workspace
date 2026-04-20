package com.jasoncompany.legacy

import java.time.LocalDateTime
import java.util.UUID

/**
 * ⚠️  레거시 주문 서비스 — 리팩토링 대상
 *
 * [SonarQube 분석 결과]
 * - Cyclomatic Complexity: 24  (권장: 10 이하)
 * - Code Smells: 17건
 * - Cognitive Complexity: 31
 * - 테스트 커버리지: 0%
 * - 책임 수: 9개 (단일 책임 원칙 위반)
 *
 * [식별된 Anti-patterns]
 * 1. God Class: 주문, 결제, 할인, 알림, 재고 모두 1개 클래스
 * 2. Long Method: processOrder() 160줄 단일 메서드
 * 3. Primitive Obsession: Map<String, Any> 남용
 * 4. Magic Number/String: 하드코딩된 할인율, 상태값
 * 5. Shotgun Surgery: 결제 수단 추가 시 5곳 수정 필요
 * 6. Feature Envy: 결제 로직이 Order 클래스 데이터에 과도하게 접근
 * 7. Dead Code: cancelOrder() 미사용 파라미터 3개
 */
class LegacyOrderService {

    // ❌ 전역 상태 — 동시성 문제 위험
    private val orders = mutableMapOf<String, MutableMap<String, Any>>()
    private val inventory = mutableMapOf<String, Int>()
    private val userEmails = mutableMapOf<String, String>()
    private val userPhones = mutableMapOf<String, String>()

    init {
        // 테스트용 초기 데이터
        inventory["ITEM-001"] = 100
        inventory["ITEM-002"] = 50
        inventory["ITEM-003"] = 200
        userEmails["USER-001"] = "alice@example.com"
        userEmails["USER-002"] = "bob@example.com"
        userPhones["USER-001"] = "010-1234-5678"
        userPhones["USER-002"] = "010-9876-5432"
    }

    /**
     * ❌ God Method — 주문 처리의 모든 것을 여기서 처리
     * Cyclomatic Complexity: 24
     * Lines: ~160
     */
    fun processOrder(
        userId: String,
        items: List<Map<String, Any>>,
        paymentMethod: String,
        couponCode: String?,
        deliveryAddress: String
    ): Map<String, Any> {

        // 1. 재고 확인 ─────────────────────────────────────────────────
        for (item in items) {
            val itemId = item["itemId"] as String
            val quantity = item["quantity"] as Int
            val stock = inventory[itemId] ?: 0
            if (stock < quantity) {
                return mapOf(
                    "success" to false,
                    "error" to "재고 부족: $itemId (재고: $stock, 요청: $quantity)",
                    "orderId" to ""
                )
            }
        }

        // 2. 가격 계산 ─────────────────────────────────────────────────
        var totalPrice = 0.0
        for (item in items) {
            val itemId = item["itemId"] as String
            val quantity = item["quantity"] as Int
            // ❌ Magic Number — 하드코딩된 가격
            val unitPrice = when (itemId) {
                "ITEM-001" -> 10000.0
                "ITEM-002" -> 25000.0
                "ITEM-003" -> 5000.0
                else -> 0.0
            }
            totalPrice += unitPrice * quantity
        }

        // 3. 할인 적용 ─────────────────────────────────────────────────
        var discountAmount = 0.0
        if (couponCode != null) {
            // ❌ Magic String — 하드코딩된 쿠폰 코드
            if (couponCode == "WELCOME10") {
                discountAmount = totalPrice * 0.10
            } else if (couponCode == "SUMMER20") {
                discountAmount = totalPrice * 0.20
            } else if (couponCode == "VIP30") {
                discountAmount = totalPrice * 0.30
            } else if (couponCode == "FLAT5000") {
                discountAmount = 5000.0
                if (discountAmount > totalPrice) discountAmount = totalPrice
            } else {
                return mapOf(
                    "success" to false,
                    "error" to "유효하지 않은 쿠폰: $couponCode",
                    "orderId" to ""
                )
            }
        }

        // VIP 사용자 추가 할인 (5%)
        // ❌ Magic String — userId 기준 하드코딩
        if (userId == "USER-VIP-001" || userId == "USER-VIP-002") {
            discountAmount += totalPrice * 0.05
        }

        // 최소 주문 금액 확인
        val finalPrice = totalPrice - discountAmount
        if (finalPrice < 1000.0) {
            return mapOf(
                "success" to false,
                "error" to "최소 주문 금액 미달 (최소: 1,000원, 현재: ${finalPrice}원)",
                "orderId" to ""
            )
        }

        // 4. 결제 처리 ─────────────────────────────────────────────────
        // ❌ Shotgun Surgery — 결제 수단 추가 시 여기도 수정 필요
        var paymentSuccess = false
        var paymentTransactionId = ""

        if (paymentMethod == "CARD") {
            // 카드 결제 처리 시뮬레이션
            if (finalPrice > 500000.0) {
                // 50만원 초과 시 카드사 승인 필요 (시뮬레이션)
                paymentSuccess = simulateCardApproval(finalPrice)
            } else {
                paymentSuccess = true
            }
            paymentTransactionId = "CARD-${UUID.randomUUID().toString().substring(0, 8).uppercase()}"

        } else if (paymentMethod == "KAKAO_PAY") {
            // 카카오페이 처리 시뮬레이션
            paymentSuccess = simulateKakaoPayApproval(userId, finalPrice)
            paymentTransactionId = "KAKAO-${UUID.randomUUID().toString().substring(0, 8).uppercase()}"

        } else if (paymentMethod == "NAVER_PAY") {
            // 네이버페이 처리 시뮬레이션
            paymentSuccess = simulateNaverPayApproval(userId, finalPrice)
            paymentTransactionId = "NAVER-${UUID.randomUUID().toString().substring(0, 8).uppercase()}"

        } else if (paymentMethod == "VIRTUAL_ACCOUNT") {
            // 가상계좌 — 항상 성공 (입금 확인은 별도 프로세스)
            paymentSuccess = true
            paymentTransactionId = "VA-${UUID.randomUUID().toString().substring(0, 8).uppercase()}"

        } else {
            return mapOf(
                "success" to false,
                "error" to "지원하지 않는 결제 수단: $paymentMethod",
                "orderId" to ""
            )
        }

        if (!paymentSuccess) {
            return mapOf(
                "success" to false,
                "error" to "결제 실패",
                "orderId" to ""
            )
        }

        // 5. 주문 생성 ─────────────────────────────────────────────────
        val orderId = "ORD-${UUID.randomUUID().toString().substring(0, 8).uppercase()}"
        val order = mutableMapOf<String, Any>(
            "orderId" to orderId,
            "userId" to userId,
            "items" to items,
            "totalPrice" to totalPrice,
            "discountAmount" to discountAmount,
            "finalPrice" to finalPrice,
            "paymentMethod" to paymentMethod,
            "paymentTransactionId" to paymentTransactionId,
            "deliveryAddress" to deliveryAddress,
            "status" to "PAID",  // ❌ Magic String 상태값
            "createdAt" to LocalDateTime.now().toString()
        )
        orders[orderId] = order

        // 6. 재고 차감 ─────────────────────────────────────────────────
        for (item in items) {
            val itemId = item["itemId"] as String
            val quantity = item["quantity"] as Int
            inventory[itemId] = (inventory[itemId] ?: 0) - quantity
        }

        // 7. 알림 발송 ─────────────────────────────────────────────────
        // ❌ 알림 로직이 주문 서비스에 직접 결합
        val userEmail = userEmails[userId]
        val userPhone = userPhones[userId]

        if (userEmail != null) {
            // 이메일 발송 시뮬레이션
            println("[EMAIL] To: $userEmail")
            println("[EMAIL] 주문이 완료되었습니다. 주문번호: $orderId, 금액: ${finalPrice}원")
        }

        if (userPhone != null) {
            // SMS 발송 시뮬레이션
            println("[SMS] To: $userPhone")
            println("[SMS] [Jason] 주문완료 $orderId / ${finalPrice.toInt()}원")
        }

        // 푸시 알림 (항상 발송)
        println("[PUSH] userId: $userId")
        println("[PUSH] 주문이 접수되었습니다: $orderId")

        // 8. 배송 시작 처리 ─────────────────────────────────────────────
        // ❌ 상태 관리가 일관성 없음 — 결제 완료 즉시 배송 시작?
        if (paymentMethod != "VIRTUAL_ACCOUNT") {
            order["status"] = "SHIPPING"
            order["shippingStartedAt"] = LocalDateTime.now().toString()
            println("[DELIVERY] 배송 시작: $orderId → $deliveryAddress")
        }

        return mapOf(
            "success" to true,
            "orderId" to orderId,
            "finalPrice" to finalPrice,
            "status" to order["status"]!!,
            "paymentTransactionId" to paymentTransactionId
        )
    }

    /**
     * ❌ Dead Code: reason, adminId 파라미터 미사용
     */
    fun cancelOrder(orderId: String, userId: String, reason: String, adminId: String?): Map<String, Any> {
        val order = orders[orderId]
            ?: return mapOf("success" to false, "error" to "주문을 찾을 수 없음: $orderId")

        if (order["userId"] != userId) {
            return mapOf("success" to false, "error" to "권한 없음")
        }

        val status = order["status"] as String
        // ❌ 중첩된 조건문 — 상태 전이 규칙이 명확하지 않음
        if (status == "PAID" || status == "PENDING") {
            order["status"] = "CANCELLED"
            order["cancelledAt"] = LocalDateTime.now().toString()

            // 재고 복구
            val items = order["items"] as List<Map<String, Any>>
            for (item in items) {
                val itemId = item["itemId"] as String
                val quantity = item["quantity"] as Int
                inventory[itemId] = (inventory[itemId] ?: 0) + quantity
            }

            // ❌ 환불 로직이 취소 로직에 혼재
            println("[REFUND] 환불 처리: ${order["finalPrice"]}원 → ${order["paymentMethod"]}")
            println("[EMAIL] 주문이 취소되었습니다: $orderId")

            return mapOf("success" to true, "orderId" to orderId, "status" to "CANCELLED")
        } else if (status == "SHIPPING") {
            return mapOf("success" to false, "error" to "배송 중인 주문은 취소할 수 없습니다")
        } else {
            return mapOf("success" to false, "error" to "취소할 수 없는 주문 상태: $status")
        }
    }

    fun getOrderStatus(orderId: String): String {
        return (orders[orderId]?.get("status") as? String) ?: "NOT_FOUND"
    }

    // ─── Private 결제 시뮬레이션 ────────────────────────────────────────

    private fun simulateCardApproval(amount: Double): Boolean {
        // 시뮬레이션: 100만원 초과는 실패
        return amount <= 1000000.0
    }

    private fun simulateKakaoPayApproval(userId: String, amount: Double): Boolean {
        // 시뮬레이션: VIP 사용자는 한도 없음, 일반은 30만원 한도
        return if (userId.startsWith("USER-VIP")) amount <= Double.MAX_VALUE
        else amount <= 300000.0
    }

    private fun simulateNaverPayApproval(userId: String, amount: Double): Boolean {
        // 시뮬레이션: 50만원 한도
        return amount <= 500000.0
    }
}
