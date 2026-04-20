package com.jasoncompany.tests.unit

import com.jasoncompany.refactored.payment.*
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * PaymentStrategy 유닛 테스트
 *
 * 작성자: 최아린 (테스트 엔지니어링 전문가)
 *
 * [리스크 기반 3문항]
 * Q1. 실패 시 얼마나 아픈가? → 결제 실패 = 매출 직접 손실 (CRITICAL)
 * Q2. 발생 가능성? → 모든 주문에서 실행 (VERY HIGH)
 * Q3. 팀이 필요성 이해? → ARB 합의 (YES)
 *
 * [테스트 설계 원칙]
 * - 각 테스트는 완전히 독립적 (상태 공유 없음)
 * - 결제사 한도 경계값 테스트 포함
 * - 파라미터화 테스트로 케이스 명확화
 */
@DisplayName("💳 PaymentStrategy 유닛 테스트")
class PaymentStrategyTest {

    // ──────────────────────────────────────────────────────────────────────
    // CardPaymentStrategy
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("CardPaymentStrategy")
    inner class CardPaymentStrategyTests {
        private val strategy = CardPaymentStrategy()

        @Test
        @DisplayName("결제 수단 식별자는 CARD 이어야 한다")
        fun `결제 수단 식별자 검증`() {
            assertEquals("CARD", strategy.paymentMethod)
        }

        @Test
        @DisplayName("100만원 이하 결제는 성공해야 한다")
        fun `100만원 이하 카드 결제 성공`() {
            val result = strategy.pay("USER-001", 1_000_000.0)
            assertTrue(result.success)
            assertTrue(result.transactionId.startsWith("CARD-"))
            assertNull(result.errorMessage)
        }

        @Test
        @DisplayName("100만원 초과 결제는 실패해야 한다")
        fun `100만원 초과 카드 결제 실패`() {
            val result = strategy.pay("USER-001", 1_000_001.0)
            assertFalse(result.success)
            assertTrue(result.errorMessage!!.contains("한도 초과"))
        }

        @Test
        @DisplayName("카드 결제는 즉시 배송 시작이어야 한다")
        fun `카드 결제 즉시 배송 시작 플래그`() {
            assertTrue(strategy.startsShippingImmediately)
        }

        @ParameterizedTest(name = "금액 {0}원: 성공={1}")
        @CsvSource(
            "1000.0, true",
            "500000.0, true",
            "999999.9, true",
            "1000000.0, true",   // 경계값 — 정확히 100만원은 성공
            "1000000.1, false",  // 경계값 — 100만원 초과는 실패
            "2000000.0, false"
        )
        @DisplayName("카드 결제 경계값 테스트")
        fun `카드 결제 경계값`(amount: Double, expectedSuccess: Boolean) {
            val result = strategy.pay("USER-001", amount)
            assertEquals(expectedSuccess, result.success,
                "금액 ${amount}원: 예상=${expectedSuccess}, 실제=${result.success}")
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // KakaoPayStrategy
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("KakaoPayStrategy")
    inner class KakaoPayStrategyTests {
        private val strategy = KakaoPayStrategy()

        @Test
        @DisplayName("일반 사용자 30만원 이하 결제 성공")
        fun `일반 사용자 카카오페이 한도 이내 성공`() {
            val result = strategy.pay("USER-001", 300_000.0)
            assertTrue(result.success)
            assertTrue(result.transactionId.startsWith("KAKAO-"))
        }

        @Test
        @DisplayName("일반 사용자 30만원 초과 결제 실패")
        fun `일반 사용자 카카오페이 한도 초과 실패`() {
            val result = strategy.pay("USER-001", 300_001.0)
            assertFalse(result.success)
            assertTrue(result.errorMessage!!.contains("한도 초과"))
        }

        @Test
        @DisplayName("VIP 사용자는 한도 제한 없이 결제 성공")
        fun `VIP 사용자 카카오페이 대용량 결제 성공`() {
            val result = strategy.pay("USER-VIP-001", 5_000_000.0)
            assertTrue(result.success, "VIP 사용자는 한도 없음")
        }

        @Test
        @DisplayName("VIP prefix 없는 사용자는 일반 한도 적용")
        fun `VIP가 아닌 사용자 한도 적용`() {
            val result = strategy.pay("USER-REGULAR-001", 400_000.0)
            assertFalse(result.success, "일반 사용자 30만원 초과 실패")
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // NaverPayStrategy
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("NaverPayStrategy")
    inner class NaverPayStrategyTests {
        private val strategy = NaverPayStrategy()

        @Test
        @DisplayName("50만원 이하 결제 성공")
        fun `네이버페이 한도 이내 성공`() {
            val result = strategy.pay("USER-001", 500_000.0)
            assertTrue(result.success)
            assertTrue(result.transactionId.startsWith("NAVER-"))
        }

        @Test
        @DisplayName("50만원 초과 결제 실패")
        fun `네이버페이 한도 초과 실패`() {
            val result = strategy.pay("USER-001", 500_001.0)
            assertFalse(result.success)
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // VirtualAccountStrategy
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("VirtualAccountStrategy")
    inner class VirtualAccountStrategyTests {
        private val strategy = VirtualAccountStrategy()

        @Test
        @DisplayName("가상계좌는 금액에 무관하게 항상 성공")
        fun `가상계좌 항상 성공`() {
            val result = strategy.pay("USER-001", 10_000_000.0)
            assertTrue(result.success)
            assertTrue(result.transactionId.startsWith("VA-"))
        }

        @Test
        @DisplayName("가상계좌는 즉시 배송 시작이 아니어야 한다")
        fun `가상계좌 배송 즉시 시작 플래그 false`() {
            assertFalse(strategy.startsShippingImmediately,
                "가상계좌는 입금 확인 전까지 배송 불가")
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // PaymentStrategyRegistry
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PaymentStrategyRegistry")
    inner class RegistryTests {

        @Test
        @DisplayName("지원하는 결제 수단 4개가 모두 등록되어야 한다")
        fun `레지스트리에 4개 결제 수단 등록`() {
            val methods = PaymentStrategyRegistry.supportedMethods()
            assertAll(
                { assertTrue(methods.contains("CARD")) },
                { assertTrue(methods.contains("KAKAO_PAY")) },
                { assertTrue(methods.contains("NAVER_PAY")) },
                { assertTrue(methods.contains("VIRTUAL_ACCOUNT")) }
            )
        }

        @Test
        @DisplayName("미지원 결제 수단 조회 시 null 반환")
        fun `미지원 결제 수단 null 반환`() {
            assertNull(PaymentStrategyRegistry.getStrategy("PAYPAL"))
            assertNull(PaymentStrategyRegistry.getStrategy("BITCOIN"))
            assertNull(PaymentStrategyRegistry.getStrategy(""))
        }

        @Test
        @DisplayName("지원 결제 수단은 올바른 전략 인스턴스 반환")
        fun `지원 결제 수단 전략 인스턴스 반환`() {
            assertNotNull(PaymentStrategyRegistry.getStrategy("CARD"))
            assertInstanceOf(CardPaymentStrategy::class.java,
                PaymentStrategyRegistry.getStrategy("CARD"))
        }
    }
}
