package com.jasoncompany.refactored.notification

/**
 * 주문 이벤트 발행/구독 시스템 — Observer Pattern
 *
 * [박지수 설계 / 이준혁 구현]
 *
 * 레거시 문제:
 * - processOrder() 안에 이메일/SMS/푸시 코드가 직접 결합 (Feature Envy)
 * - 새 알림 채널(Slack, 카카오 알림톡 등) 추가 시 processOrder() 수정 필요
 *
 * 개선:
 * - OrderProcessor는 이벤트만 발행, 알림 채널은 알아서 구독
 * - 새 채널: OrderEventSubscriber 구현 + 구독 등록만 하면 됨
 * - 알림 실패가 주문 처리에 영향 없도록 격리
 *
 * [최아린 Testability 피드백 반영]
 * - 구독자를 생성자로 주입 → MockK로 검증 가능
 * - 이벤트별로 분리 → 단위 테스트 명확
 */
interface OrderEventSubscriber {
    fun onOrderPlaced(orderId: String, userId: String, amount: Double)
    fun onOrderCancelled(orderId: String, userId: String)
    fun onOrderShipped(orderId: String, address: String)
}

class OrderEventPublisher {
    private val subscribers = mutableListOf<OrderEventSubscriber>()

    fun subscribe(subscriber: OrderEventSubscriber) {
        subscribers.add(subscriber)
    }

    fun unsubscribe(subscriber: OrderEventSubscriber) {
        subscribers.remove(subscriber)
    }

    /**
     * 주문 완료 이벤트 발행
     * 알림 실패 시 오류 로그만 기록 — 주문 처리 중단 없음
     */
    fun publishOrderPlaced(orderId: String, userId: String, amount: Double) {
        subscribers.forEach { subscriber ->
            runCatching {
                subscriber.onOrderPlaced(orderId, userId, amount)
            }.onFailure { e ->
                // ✅ 알림 실패가 주문 실패로 이어지지 않음
                System.err.println("[EVENT] onOrderPlaced 실패 — ${subscriber::class.simpleName}: ${e.message}")
            }
        }
    }

    fun publishOrderCancelled(orderId: String, userId: String) {
        subscribers.forEach { subscriber ->
            runCatching {
                subscriber.onOrderCancelled(orderId, userId)
            }.onFailure { e ->
                System.err.println("[EVENT] onOrderCancelled 실패 — ${subscriber::class.simpleName}: ${e.message}")
            }
        }
    }

    fun publishOrderShipped(orderId: String, address: String) {
        subscribers.forEach { subscriber ->
            runCatching {
                subscriber.onOrderShipped(orderId, address)
            }.onFailure { e ->
                System.err.println("[EVENT] onOrderShipped 실패 — ${subscriber::class.simpleName}: ${e.message}")
            }
        }
    }

    fun subscriberCount(): Int = subscribers.size
}

// ──────────────────────────────────────────────────────────────────────────
// 구독자 구현체들
// ──────────────────────────────────────────────────────────────────────────

class EmailNotifier(
    private val userEmailResolver: (String) -> String?
) : OrderEventSubscriber {

    override fun onOrderPlaced(orderId: String, userId: String, amount: Double) {
        val email = userEmailResolver(userId) ?: return
        println("[EMAIL] To: $email")
        println("[EMAIL] 주문이 완료되었습니다. 주문번호: $orderId, 금액: ${amount}원")
    }

    override fun onOrderCancelled(orderId: String, userId: String) {
        val email = userEmailResolver(userId) ?: return
        println("[EMAIL] To: $email")
        println("[EMAIL] 주문이 취소되었습니다: $orderId")
    }

    override fun onOrderShipped(orderId: String, address: String) {
        // 이메일 배송 알림은 배송추적 링크 포함 (실제 구현 시 추가)
        println("[EMAIL] 배송이 시작되었습니다: $orderId → $address")
    }
}

class SmsNotifier(
    private val userPhoneResolver: (String) -> String?
) : OrderEventSubscriber {

    override fun onOrderPlaced(orderId: String, userId: String, amount: Double) {
        val phone = userPhoneResolver(userId) ?: return
        println("[SMS] To: $phone")
        println("[SMS] [Jason] 주문완료 $orderId / ${amount.toInt()}원")
    }

    override fun onOrderCancelled(orderId: String, userId: String) {
        val phone = userPhoneResolver(userId) ?: return
        println("[SMS] To: $phone")
        println("[SMS] [Jason] 주문취소 $orderId")
    }

    override fun onOrderShipped(orderId: String, address: String) {
        println("[SMS] 배송출발 $orderId")
    }
}

class PushNotifier : OrderEventSubscriber {

    override fun onOrderPlaced(orderId: String, userId: String, amount: Double) {
        println("[PUSH] userId: $userId")
        println("[PUSH] 주문이 접수되었습니다: $orderId")
    }

    override fun onOrderCancelled(orderId: String, userId: String) {
        println("[PUSH] userId: $userId")
        println("[PUSH] 주문이 취소되었습니다: $orderId")
    }

    override fun onOrderShipped(orderId: String, address: String) {
        println("[PUSH] 배송이 시작되었습니다: $orderId")
    }
}
