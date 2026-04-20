package com.jasoncompany.refactored.payment

/**
 * 결제 전략 인터페이스 — Strategy Pattern
 *
 * [박지수 설계 / 이준혁 구현]
 *
 * 레거시 문제:
 * - processOrder() 안에 CARD/KAKAO_PAY/NAVER_PAY/VIRTUAL_ACCOUNT if-else 40줄
 * - 새 결제사 추가 시 processOrder() 수정 (OCP 위반 + Shotgun Surgery)
 *
 * 개선:
 * - 각 결제사가 독립적인 PaymentStrategy 구현체
 * - OrderProcessor는 PaymentStrategy 인터페이스만 알면 됨
 * - 새 결제사: PaymentStrategy 구현체 추가만 하면 됨 (기존 코드 수정 없음)
 */
interface PaymentStrategy {
    /** 결제 수단 식별자 */
    val paymentMethod: String

    /**
     * 결제 실행
     * @param userId 사용자 ID (한도 및 VIP 여부 판단에 사용)
     * @param amount 결제 금액
     * @return PaymentResult (성공/실패 + 트랜잭션 ID)
     */
    fun pay(userId: String, amount: Double): PaymentResult

    /**
     * 결제 완료 후 즉시 배송 시작 여부
     * 가상계좌는 입금 확인 전까지 배송 시작 불가 → false
     */
    val startsShippingImmediately: Boolean get() = true
}

data class PaymentResult(
    val success: Boolean,
    val transactionId: String,
    val errorMessage: String? = null
)

// ──────────────────────────────────────────────────────────────────────────
// 구현체 1: 카드 결제
// ──────────────────────────────────────────────────────────────────────────

/**
 * 카드 결제 전략
 *
 * [이준혁 Strangler Fig 노트]
 * 레거시의 simulateCardApproval() 로직을 여기로 이전.
 * 레거시 메서드는 Golden Master 테스트가 모두 통과할 때까지 유지.
 */
class CardPaymentStrategy : PaymentStrategy {
    override val paymentMethod = "CARD"

    override fun pay(userId: String, amount: Double): PaymentResult {
        // 100만원 초과 시 카드사 승인 필요 (시뮬레이션)
        val approved = amount <= CARD_APPROVAL_LIMIT
        return if (approved) {
            PaymentResult(
                success = true,
                transactionId = "CARD-${generateTransactionId()}"
            )
        } else {
            PaymentResult(
                success = false,
                transactionId = "",
                errorMessage = "카드 결제 한도 초과 (한도: ${CARD_APPROVAL_LIMIT}원, 요청: ${amount}원)"
            )
        }
    }

    companion object {
        private const val CARD_APPROVAL_LIMIT = 1_000_000.0
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 구현체 2: 카카오페이
// ──────────────────────────────────────────────────────────────────────────

class KakaoPayStrategy : PaymentStrategy {
    override val paymentMethod = "KAKAO_PAY"

    override fun pay(userId: String, amount: Double): PaymentResult {
        val limit = if (userId.startsWith("USER-VIP")) Double.MAX_VALUE else GENERAL_LIMIT
        val approved = amount <= limit
        return if (approved) {
            PaymentResult(
                success = true,
                transactionId = "KAKAO-${generateTransactionId()}"
            )
        } else {
            PaymentResult(
                success = false,
                transactionId = "",
                errorMessage = "카카오페이 한도 초과 (한도: ${GENERAL_LIMIT}원)"
            )
        }
    }

    companion object {
        private const val GENERAL_LIMIT = 300_000.0
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 구현체 3: 네이버페이
// ──────────────────────────────────────────────────────────────────────────

class NaverPayStrategy : PaymentStrategy {
    override val paymentMethod = "NAVER_PAY"

    override fun pay(userId: String, amount: Double): PaymentResult {
        val approved = amount <= LIMIT
        return if (approved) {
            PaymentResult(
                success = true,
                transactionId = "NAVER-${generateTransactionId()}"
            )
        } else {
            PaymentResult(
                success = false,
                transactionId = "",
                errorMessage = "네이버페이 한도 초과 (한도: ${LIMIT}원)"
            )
        }
    }

    companion object {
        private const val LIMIT = 500_000.0
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 구현체 4: 가상계좌
// ──────────────────────────────────────────────────────────────────────────

class VirtualAccountStrategy : PaymentStrategy {
    override val paymentMethod = "VIRTUAL_ACCOUNT"

    // ✅ 가상계좌는 입금 확인 후 배송 → 즉시 배송 시작 안 함
    override val startsShippingImmediately = false

    override fun pay(userId: String, amount: Double): PaymentResult {
        // 가상계좌는 발급 자체는 항상 성공 (실제 입금은 별도 프로세스)
        return PaymentResult(
            success = true,
            transactionId = "VA-${generateTransactionId()}"
        )
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 결제 전략 레지스트리 — 새 결제사 추가 시 여기에만 등록
// ──────────────────────────────────────────────────────────────────────────

object PaymentStrategyRegistry {
    private val strategies: Map<String, PaymentStrategy> = mapOf(
        "CARD"            to CardPaymentStrategy(),
        "KAKAO_PAY"       to KakaoPayStrategy(),
        "NAVER_PAY"       to NaverPayStrategy(),
        "VIRTUAL_ACCOUNT" to VirtualAccountStrategy()
    )

    fun getStrategy(paymentMethod: String): PaymentStrategy? = strategies[paymentMethod]

    fun supportedMethods(): Set<String> = strategies.keys
}

// 공통 유틸
private fun generateTransactionId(): String =
    java.util.UUID.randomUUID().toString().substring(0, 8).uppercase()
