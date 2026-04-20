package com.jasoncompany.tests.unit

import com.jasoncompany.refactored.order.OrderStateMachine
import com.jasoncompany.refactored.order.OrderStatus
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * OrderStateMachine 유닛 테스트
 *
 * 작성자: 최아린 (테스트 엔지니어링 전문가)
 *
 * [리스크 기반 3문항]
 * Q1. 실패 시 얼마나 아픈가?
 *   → 잘못된 상태 전이 = 배송 완료된 주문이 취소되거나, 취소된 주문이 배송되는 사고 (CRITICAL)
 * Q2. 발생 가능성?
 *   → 모든 주문 상태 변경에서 실행 (HIGH)
 * Q3. 팀이 이해? → ARB 합의 (YES)
 *
 * [테스트 설계]
 * - 정상 전이 경로: PENDING → PAID → SHIPPING → DELIVERED
 * - 취소 경로: PENDING/PAID → CANCELLED → REFUNDED
 * - 불가 전이: 각 상태에서 허용되지 않는 모든 전이 검증
 */
@DisplayName("🔄 OrderStateMachine 유닛 테스트")
class OrderStateMachineTest {

    @Nested
    @DisplayName("정상 전이 경로")
    inner class HappyPathTests {

        @Test
        @DisplayName("초기 상태는 PENDING이어야 한다")
        fun `기본 초기 상태 PENDING`() {
            val stateMachine = OrderStateMachine()
            assertEquals(OrderStatus.PENDING, stateMachine.currentStatus)
        }

        @Test
        @DisplayName("PENDING → PAID 전이 성공")
        fun `PENDING에서 PAID로 전이`() {
            val sm = OrderStateMachine()
            sm.markAsPaid()
            assertEquals(OrderStatus.PAID, sm.currentStatus)
        }

        @Test
        @DisplayName("PAID → SHIPPING 전이 성공")
        fun `PAID에서 SHIPPING으로 전이`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().markAsShipping()
            assertEquals(OrderStatus.SHIPPING, sm.currentStatus)
        }

        @Test
        @DisplayName("SHIPPING → DELIVERED 전이 성공")
        fun `SHIPPING에서 DELIVERED로 전이`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().markAsShipping().markAsDelivered()
            assertEquals(OrderStatus.DELIVERED, sm.currentStatus)
        }

        @Test
        @DisplayName("PENDING → PAID → CANCELLED → REFUNDED 전체 취소 경로")
        fun `취소 경로 전체 검증`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().cancel().markAsRefunded()
            assertEquals(OrderStatus.REFUNDED, sm.currentStatus)
        }

        @Test
        @DisplayName("PENDING 상태에서 바로 취소 가능")
        fun `PENDING 직접 취소`() {
            val sm = OrderStateMachine()
            sm.cancel()
            assertEquals(OrderStatus.CANCELLED, sm.currentStatus)
        }
    }

    @Nested
    @DisplayName("불가 전이 — IllegalStateException 발생 검증")
    inner class InvalidTransitionTests {

        @Test
        @DisplayName("PENDING 상태에서 SHIPPING 직접 전이 불가")
        fun `PENDING에서 SHIPPING 직접 전이 실패`() {
            val sm = OrderStateMachine()
            assertThrows<IllegalStateException> {
                sm.markAsShipping()
            }.also { e ->
                assertTrue(e.message!!.contains("PENDING"),
                    "에러 메시지에 현재 상태 PENDING 포함")
            }
        }

        @Test
        @DisplayName("SHIPPING 상태에서 취소 불가")
        fun `배송 중 취소 불가`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().markAsShipping()

            val exception = assertThrows<IllegalStateException> {
                sm.cancel()
            }
            assertTrue(exception.message!!.contains("SHIPPING"),
                "에러 메시지에 SHIPPING 포함")
            assertTrue(exception.message!!.contains("PENDING, PAID"),
                "허용 상태 명시")
        }

        @Test
        @DisplayName("DELIVERED 상태에서 추가 결제 전이 불가")
        fun `배송 완료 후 결제 전이 불가`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().markAsShipping().markAsDelivered()

            assertThrows<IllegalStateException> {
                sm.markAsPaid()
            }
        }

        @Test
        @DisplayName("CANCELLED 상태에서 배송 시작 불가")
        fun `취소 후 배송 시작 불가`() {
            val sm = OrderStateMachine()
            sm.cancel()

            assertThrows<IllegalStateException> {
                sm.markAsShipping()
            }
        }

        @Test
        @DisplayName("REFUNDED 상태는 최종 상태 — 모든 전이 불가")
        fun `환불 완료 후 모든 전이 불가`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().cancel().markAsRefunded()

            assertAll(
                {
                    assertThrows<IllegalStateException> { sm.markAsPaid() }
                },
                {
                    assertThrows<IllegalStateException> { sm.cancel() }
                },
                {
                    assertThrows<IllegalStateException> { sm.markAsShipping() }
                }
            )
        }
    }

    @Nested
    @DisplayName("가용 전이 목록")
    inner class AvailableTransitionsTests {

        @Test
        @DisplayName("PENDING 상태에서 가능한 전이 목록")
        fun `PENDING 가용 전이 목록`() {
            val sm = OrderStateMachine()
            val transitions = sm.availableTransitions()
            assertTrue(transitions.any { it.contains("markAsPaid") })
            assertTrue(transitions.any { it.contains("cancel") })
        }

        @Test
        @DisplayName("SHIPPING 상태에서는 DELIVERED로만 전이 가능")
        fun `SHIPPING 가용 전이 목록`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().markAsShipping()
            val transitions = sm.availableTransitions()
            assertEquals(1, transitions.size, "SHIPPING에서는 1가지 전이만 가능")
            assertTrue(transitions[0].contains("markAsDelivered"))
        }

        @Test
        @DisplayName("REFUNDED는 최종 상태 — 전이 없음")
        fun `REFUNDED 최종 상태 전이 목록`() {
            val sm = OrderStateMachine()
            sm.markAsPaid().cancel().markAsRefunded()
            val transitions = sm.availableTransitions()
            assertTrue(transitions[0].contains("최종 상태"),
                "최종 상태임을 명시해야 함")
        }
    }

    @Nested
    @DisplayName("커스텀 초기 상태")
    inner class CustomInitialStateTests {

        @Test
        @DisplayName("PAID 초기 상태로 생성 가능 (DB 복원 시나리오)")
        fun `PAID 상태로 초기화`() {
            val sm = OrderStateMachine(OrderStatus.PAID)
            assertEquals(OrderStatus.PAID, sm.currentStatus)
            // PAID에서 즉시 SHIPPING 가능해야 함
            sm.markAsShipping()
            assertEquals(OrderStatus.SHIPPING, sm.currentStatus)
        }
    }
}
