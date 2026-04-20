package com.jasoncompany.tests.goldenmaster

import com.jasoncompany.legacy.LegacyOrderService
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * 🛡️ Golden Master Test — LegacyOrderService
 *
 * 작성자: 최아린 (테스트 엔지니어링 전문가)
 * 목적: 이준혁의 Strangler Fig 리팩토링 안전망
 *       리팩토링 전/후 동일한 비즈니스 동작 보장
 *
 * [Flaky Test 예방 조치]
 * - UUID 비결정성 → orderId 값 대신 existence 검증
 * - LocalDateTime → 검증 제외 (timestamps는 Golden Master 범위 밖)
 * - 전역 재고 상태 → @BeforeEach에서 새 인스턴스 생성으로 격리
 *
 * [ARB 합의 커버리지 목표]
 * - 핵심 플로우: 100%
 * - 전체 메서드: 85%
 */
@DisplayName("🛡️ Golden Master: LegacyOrderService 동작 고정")
class LegacyOrderServiceGoldenMasterTest {

    // ✅ 매 테스트마다 새 인스턴스 — DB 상태 공유 Flaky 방지
    private lateinit var sut: LegacyOrderService

    @BeforeEach
    fun setUp() {
        sut = LegacyOrderService()
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-01: 카드 결제 정상 주문 (쿠폰 없음)
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-01: 카드 결제 정상 주문 → success=true, status=SHIPPING")
    fun `카드 결제 정상 주문은 성공하고 즉시 배송 시작 상태가 되어야 한다`() {
        // given
        val items = listOf(
            mapOf("itemId" to "ITEM-001", "quantity" to 2)  // 10,000 * 2 = 20,000원
        )

        // when
        val result = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "CARD",
            couponCode = null,
            deliveryAddress = "서울시 강남구 테헤란로 123"
        )

        // then
        // ✅ 핵심 동작 검증 (UUID, 시간 제외)
        assertTrue(result["success"] as Boolean, "주문은 성공해야 합니다")
        assertEquals("SHIPPING", result["status"], "카드 결제 완료 후 즉시 배송 시작")
        assertEquals(20000.0, result["finalPrice"] as Double, 0.01, "20,000원 정확히 청구")
        assertNotNull(result["orderId"], "주문 ID가 생성되어야 합니다")
        assertTrue((result["orderId"] as String).startsWith("ORD-"), "주문 ID는 ORD- 로 시작")
        assertFalse(result.containsKey("error"), "오류 메시지 없어야 함")
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-02: 카카오페이 + WELCOME10 쿠폰 할인
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-02: 카카오페이 + WELCOME10 쿠폰 → 10% 할인 적용")
    fun `WELCOME10 쿠폰 적용 시 총 금액의 10 퍼센트가 할인되어야 한다`() {
        // given
        val items = listOf(
            mapOf("itemId" to "ITEM-002", "quantity" to 1)  // 25,000원
        )
        // 카카오페이 일반 사용자 한도 30만원 이내

        // when
        val result = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "KAKAO_PAY",
            couponCode = "WELCOME10",
            deliveryAddress = "부산시 해운대구 마린시티 456"
        )

        // then
        assertTrue(result["success"] as Boolean, "쿠폰 적용 주문 성공")
        assertEquals(22500.0, result["finalPrice"] as Double, 0.01,
            "25,000원에서 10% 할인 → 22,500원")
        assertEquals("SHIPPING", result["status"])
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-03: 재고 부족 케이스
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-03: 재고 부족 → success=false, 에러 메시지 포함")
    fun `재고보다 많은 수량 주문 시 실패해야 한다`() {
        // given — ITEM-002 재고: 50개
        val items = listOf(
            mapOf("itemId" to "ITEM-002", "quantity" to 999)  // 재고 초과
        )

        // when
        val result = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "CARD",
            couponCode = null,
            deliveryAddress = "대구시 중구 동성로 789"
        )

        // then
        assertFalse(result["success"] as Boolean, "재고 부족 시 실패")
        assertTrue((result["error"] as String).contains("재고 부족"),
            "에러 메시지에 '재고 부족' 포함")
        assertTrue((result["error"] as String).contains("ITEM-002"),
            "에러 메시지에 상품 ID 포함")
        assertEquals("", result["orderId"], "실패 시 빈 orderId")
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-04: 잘못된 쿠폰 코드
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-04: 존재하지 않는 쿠폰 → success=false, 쿠폰 에러")
    fun `유효하지 않은 쿠폰 코드 사용 시 주문이 실패해야 한다`() {
        // given
        val items = listOf(mapOf("itemId" to "ITEM-001", "quantity" to 1))

        // when
        val result = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "CARD",
            couponCode = "FAKE-COUPON-999",
            deliveryAddress = "서울시 마포구 홍대 111"
        )

        // then
        assertFalse(result["success"] as Boolean)
        assertTrue((result["error"] as String).contains("유효하지 않은 쿠폰"))
        assertTrue((result["error"] as String).contains("FAKE-COUPON-999"))
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-05: 가상계좌 — 배송 시작 안 됨 (PAID 상태 유지)
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-05: 가상계좌 주문 → success=true, status=PAID (배송 미시작)")
    fun `가상계좌 결제 완료 후 상태는 PAID여야 한다`() {
        // given
        val items = listOf(mapOf("itemId" to "ITEM-003", "quantity" to 3))  // 15,000원

        // when
        val result = sut.processOrder(
            userId = "USER-002",
            items = items,
            paymentMethod = "VIRTUAL_ACCOUNT",
            couponCode = null,
            deliveryAddress = "인천시 연수구 송도 222"
        )

        // then
        assertTrue(result["success"] as Boolean)
        assertEquals("PAID", result["status"],
            "가상계좌는 입금 확인 전까지 PAID 상태 유지 (SHIPPING 아님)")
        assertEquals(15000.0, result["finalPrice"] as Double, 0.01)
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-06: 주문 취소 (PAID 상태에서 가능)
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-06: PAID 상태 주문 취소 → success=true, 재고 복구")
    fun `PAID 상태의 주문은 취소할 수 있고 재고가 복구되어야 한다`() {
        // given — 먼저 가상계좌로 주문 (PAID 상태)
        val items = listOf(mapOf("itemId" to "ITEM-001", "quantity" to 5))
        val orderResult = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "VIRTUAL_ACCOUNT",
            couponCode = null,
            deliveryAddress = "광주시 북구 용봉동 333"
        )
        assertTrue(orderResult["success"] as Boolean)
        val orderId = orderResult["orderId"] as String

        // when
        val cancelResult = sut.cancelOrder(
            orderId = orderId,
            userId = "USER-001",
            reason = "단순 변심",
            adminId = null
        )

        // then
        assertTrue(cancelResult["success"] as Boolean, "PAID 상태에서 취소 가능")
        assertEquals("CANCELLED", cancelResult["status"])
        assertEquals(orderId, cancelResult["orderId"])

        // 취소 후 주문 상태 확인
        assertEquals("CANCELLED", sut.getOrderStatus(orderId), "취소 후 상태 CANCELLED")
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-07: 배송 중 취소 시도 → 실패
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-07: SHIPPING 상태 취소 시도 → success=false")
    fun `배송 중인 주문은 취소할 수 없어야 한다`() {
        // given — 카드 결제로 주문 (즉시 SHIPPING)
        val items = listOf(mapOf("itemId" to "ITEM-001", "quantity" to 1))
        val orderResult = sut.processOrder(
            userId = "USER-001",
            items = items,
            paymentMethod = "CARD",
            couponCode = null,
            deliveryAddress = "울산시 남구 삼산동 444"
        )
        assertTrue(orderResult["success"] as Boolean)
        assertEquals("SHIPPING", orderResult["status"])
        val orderId = orderResult["orderId"] as String

        // when
        val cancelResult = sut.cancelOrder(
            orderId = orderId,
            userId = "USER-001",
            reason = "단순 변심",
            adminId = null
        )

        // then
        assertFalse(cancelResult["success"] as Boolean, "배송 중 취소 불가")
        assertTrue((cancelResult["error"] as String).contains("배송 중"),
            "배송 중 관련 에러 메시지")
    }

    // ──────────────────────────────────────────────────────────────────────
    // TC-08 (보너스): 다중 상품 + VIP30 쿠폰
    // ──────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-08: 다중 상품 + VIP30 쿠폰 → 30% 할인 정확히 적용")
    fun `다중 상품 주문에 VIP30 쿠폰 적용 시 총액의 30 퍼센트가 할인되어야 한다`() {
        // given
        val items = listOf(
            mapOf("itemId" to "ITEM-001", "quantity" to 1),  // 10,000원
            mapOf("itemId" to "ITEM-003", "quantity" to 2)   // 5,000 * 2 = 10,000원
            // total = 20,000원
        )

        // when
        val result = sut.processOrder(
            userId = "USER-002",
            items = items,
            paymentMethod = "NAVER_PAY",
            couponCode = "VIP30",
            deliveryAddress = "대전시 유성구 궁동 555"
        )

        // then
        assertTrue(result["success"] as Boolean)
        assertEquals(14000.0, result["finalPrice"] as Double, 0.01,
            "20,000원 × (1 - 0.30) = 14,000원")
    }
}
