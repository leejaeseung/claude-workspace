package com.jasoncompany.tests.unit

import com.jasoncompany.refactored.notification.*
import org.junit.jupiter.api.*
import org.junit.jupiter.api.Assertions.*

/**
 * OrderEventPublisher 유닛 테스트
 *
 * 작성자: 최아린 (테스트 엔지니어링 전문가)
 *
 * [박지수 패턴 Testability 피드백 반영]
 * Observer Pattern 적용으로 테스트 용이성 크게 향상:
 * - 레거시: println() 직접 호출 → 테스트 불가
 * - 리팩토링: OrderEventSubscriber 인터페이스 → Mock 구독자로 검증 가능
 *
 * [Flaky Test 예방]
 * - 각 테스트마다 새 Publisher 인스턴스 (상태 공유 없음)
 * - 실제 이메일/SMS 발송 없음 (인터페이스 구현 통해 격리)
 */
@DisplayName("📢 OrderEventPublisher 유닛 테스트")
class OrderEventPublisherTest {

    private lateinit var publisher: OrderEventPublisher

    @BeforeEach
    fun setUp() {
        publisher = OrderEventPublisher()
    }

    // ──────────────────────────────────────────────────────────────────────
    // 구독자 등록/해제
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("구독자 관리")
    inner class SubscriberManagementTests {

        @Test
        @DisplayName("구독자 없을 때 subscriber count는 0")
        fun `초기 구독자 수 0`() {
            assertEquals(0, publisher.subscriberCount())
        }

        @Test
        @DisplayName("구독자 등록 후 count 증가")
        fun `구독자 등록 후 카운트 증가`() {
            publisher.subscribe(RecordingSubscriber())
            publisher.subscribe(RecordingSubscriber())
            assertEquals(2, publisher.subscriberCount())
        }

        @Test
        @DisplayName("구독 해제 후 count 감소")
        fun `구독 해제 후 카운트 감소`() {
            val subscriber = RecordingSubscriber()
            publisher.subscribe(subscriber)
            publisher.unsubscribe(subscriber)
            assertEquals(0, publisher.subscriberCount())
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 주문 완료 이벤트 발행
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("publishOrderPlaced")
    inner class OrderPlacedTests {

        @Test
        @DisplayName("구독자가 없을 때 이벤트 발행 시 예외 없음")
        fun `구독자 없을 때 이벤트 발행 안전`() {
            assertDoesNotThrow {
                publisher.publishOrderPlaced("ORD-001", "USER-001", 50000.0)
            }
        }

        @Test
        @DisplayName("등록된 구독자에게 정확한 데이터로 이벤트 전달")
        fun `구독자에게 올바른 이벤트 전달`() {
            val subscriber = RecordingSubscriber()
            publisher.subscribe(subscriber)

            publisher.publishOrderPlaced("ORD-TEST-001", "USER-001", 75000.0)

            val event = subscriber.orderPlacedEvents.single()
            assertEquals("ORD-TEST-001", event.orderId)
            assertEquals("USER-001", event.userId)
            assertEquals(75000.0, event.amount, 0.01)
        }

        @Test
        @DisplayName("다수 구독자에게 모두 이벤트 전달")
        fun `다수 구독자 모두 이벤트 수신`() {
            val subscriber1 = RecordingSubscriber()
            val subscriber2 = RecordingSubscriber()
            val subscriber3 = RecordingSubscriber()

            publisher.subscribe(subscriber1)
            publisher.subscribe(subscriber2)
            publisher.subscribe(subscriber3)

            publisher.publishOrderPlaced("ORD-001", "USER-001", 1000.0)

            assertEquals(1, subscriber1.orderPlacedEvents.size)
            assertEquals(1, subscriber2.orderPlacedEvents.size)
            assertEquals(1, subscriber3.orderPlacedEvents.size)
        }

        @Test
        @DisplayName("한 구독자 실패해도 다른 구독자는 정상 동작 (격리)")
        fun `구독자 실패 격리 — 다른 구독자 영향 없음`() {
            val failingSubscriber = FailingSubscriber()
            val normalSubscriber = RecordingSubscriber()

            publisher.subscribe(failingSubscriber)
            publisher.subscribe(normalSubscriber)

            // 실패 구독자가 있어도 예외 전파 안 됨
            assertDoesNotThrow {
                publisher.publishOrderPlaced("ORD-001", "USER-001", 1000.0)
            }

            // 정상 구독자는 이벤트 수신
            assertEquals(1, normalSubscriber.orderPlacedEvents.size,
                "실패 구독자가 있어도 정상 구독자는 이벤트 수신")
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 주문 취소 이벤트
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("publishOrderCancelled")
    inner class OrderCancelledTests {

        @Test
        @DisplayName("취소 이벤트 구독자에게 정확히 전달")
        fun `취소 이벤트 전달 검증`() {
            val subscriber = RecordingSubscriber()
            publisher.subscribe(subscriber)

            publisher.publishOrderCancelled("ORD-001", "USER-001")

            val event = subscriber.orderCancelledEvents.single()
            assertEquals("ORD-001", event.orderId)
            assertEquals("USER-001", event.userId)
        }

        @Test
        @DisplayName("주문 완료와 취소 이벤트 독립적으로 기록")
        fun `이벤트 타입별 독립 기록`() {
            val subscriber = RecordingSubscriber()
            publisher.subscribe(subscriber)

            publisher.publishOrderPlaced("ORD-001", "USER-001", 1000.0)
            publisher.publishOrderCancelled("ORD-002", "USER-002")

            assertEquals(1, subscriber.orderPlacedEvents.size)
            assertEquals(1, subscriber.orderCancelledEvents.size)
            assertEquals(0, subscriber.orderShippedEvents.size)
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 배송 이벤트
    // ──────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("publishOrderShipped")
    inner class OrderShippedTests {

        @Test
        @DisplayName("배송 이벤트 orderId와 주소 정확히 전달")
        fun `배송 이벤트 전달 검증`() {
            val subscriber = RecordingSubscriber()
            publisher.subscribe(subscriber)

            publisher.publishOrderShipped("ORD-001", "서울시 강남구 테헤란로 123")

            val event = subscriber.orderShippedEvents.single()
            assertEquals("ORD-001", event.orderId)
            assertEquals("서울시 강남구 테헤란로 123", event.address)
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────
// 테스트 유틸 — 이벤트 기록 구독자
// ──────────────────────────────────────────────────────────────────────────

/** 이벤트를 기록하는 테스트용 구독자 */
class RecordingSubscriber : OrderEventSubscriber {
    data class PlacedEvent(val orderId: String, val userId: String, val amount: Double)
    data class CancelledEvent(val orderId: String, val userId: String)
    data class ShippedEvent(val orderId: String, val address: String)

    val orderPlacedEvents = mutableListOf<PlacedEvent>()
    val orderCancelledEvents = mutableListOf<CancelledEvent>()
    val orderShippedEvents = mutableListOf<ShippedEvent>()

    override fun onOrderPlaced(orderId: String, userId: String, amount: Double) {
        orderPlacedEvents.add(PlacedEvent(orderId, userId, amount))
    }

    override fun onOrderCancelled(orderId: String, userId: String) {
        orderCancelledEvents.add(CancelledEvent(orderId, userId))
    }

    override fun onOrderShipped(orderId: String, address: String) {
        orderShippedEvents.add(ShippedEvent(orderId, address))
    }
}

/** 항상 예외를 던지는 테스트용 구독자 (격리 테스트용) */
class FailingSubscriber : OrderEventSubscriber {
    override fun onOrderPlaced(orderId: String, userId: String, amount: Double) {
        throw RuntimeException("FailingSubscriber: 의도적 실패 (격리 테스트용)")
    }

    override fun onOrderCancelled(orderId: String, userId: String) {
        throw RuntimeException("FailingSubscriber: 의도적 실패")
    }

    override fun onOrderShipped(orderId: String, address: String) {
        throw RuntimeException("FailingSubscriber: 의도적 실패")
    }
}
