# 패턴 분석 및 리팩토링 설계

**작성자**: 박지수 (OOP 패턴 전문가)  
**작성일**: 2026-04-19  
**ARB 안건 제출**: 박지수 → 김도현 (의장) → ARB 승인 완료

---

## 1. Anti-pattern 분석 보고서

> "가장 위험한 행동: 즉각 수정  
> 올바른 행동: 기록하고 → 알리고 → 합의를 구함"

### 발견된 Anti-patterns (우선순위 순)

#### 🔴 P1 (Critical) — God Class

```
LegacyOrderService가 담당하는 책임:
1. 재고 검증
2. 가격 계산
3. 할인 계산 (쿠폰, VIP)
4. 카드 결제 처리
5. 카카오페이 결제 처리
6. 네이버페이 결제 처리
7. 가상계좌 결제 처리
8. 주문 생성 및 저장
9. 재고 차감
10. 이메일 알림
11. SMS 알림
12. 푸시 알림
13. 배송 시작 처리
14. 주문 취소 처리
15. 환불 처리

→ 단일 클래스에 15개 책임. SRP 완전 위반.
```

#### 🔴 P2 (Critical) — Shotgun Surgery

```
결제 수단을 1개 추가하면 수정 필요한 곳:
1. processOrder() if-else 체인 (추가)
2. cancelOrder() 환불 로직 (추가)
3. simulateXxxApproval() 신규 메서드 (추가)
4. 관련 테스트 (추가)
5. API 문서 (추가)

→ OCP 위반. 변경에 열려 있고, 확장에 닫혀 있음.
```

#### 🟡 P3 (High) — Primitive Obsession

```kotlin
// ❌ 현재
fun processOrder(items: List<Map<String, Any>>, ...) : Map<String, Any>

// ✅ 권장
fun processOrder(items: List<OrderItem>, ...) : OrderResult
```

#### 🟡 P4 (High) — Magic Number / Magic String

```kotlin
// ❌ 현재 — 이 상수들의 의미를 코드만 봐서는 알 수 없음
if (couponCode == "WELCOME10") discountAmount = totalPrice * 0.10
if (userId == "USER-VIP-001" || userId == "USER-VIP-002") ...
if (finalPrice < 1000.0) ...
order["status"] = "PAID"
```

#### 🟠 P5 (Medium) — Dead Code

```kotlin
// cancelOrder()의 reason, adminId 파라미터 — 실제로 사용되지 않음
fun cancelOrder(orderId: String, userId: String, reason: String, adminId: String?)
```

---

## 2. 패턴 도입 3기준 검증

### Strategy Pattern — 결제 수단 처리

```
기준 1: 현재 코드가 변경에 닫혀 있는가? (OCP 위반이 실제 발생 중)
→ ✅ YES — 결제 수단 추가/제거 시 processOrder() 전체를 수정해야 함

기준 2: 동일한 구조적 문제가 3곳 이상 반복되는가? (Rule of Three)
→ ✅ YES — CARD, KAKAO_PAY, NAVER_PAY, VIRTUAL_ACCOUNT 4개 동일 구조

기준 3: 팀원이 이 코드를 이해하는 데 어려움을 겪고 있는가?
→ ✅ YES — if-else 체인이 40줄 이상. 신규 결제사 추가 시 어디에 넣어야 할지 불명확

결론: 3기준 전부 충족 → Strategy Pattern 도입 정당화
```

### Observer Pattern — 알림 처리

```
기준 1: 현재 코드가 변경에 닫혀 있는가?
→ ✅ YES — 알림 채널 추가 시 processOrder() 내부 수정 필요

기준 2: 동일한 구조적 문제가 3곳 이상 반복되는가?
→ ✅ YES — email, SMS, push 3개 알림이 동일한 패턴으로 직접 결합

기준 3: 팀원이 이해하는 데 어려움?
→ ✅ YES — 주문 로직 안에 알림 코드가 섞여서 흐름 파악 어려움

결론: 3기준 전부 충족 → Observer Pattern 도입 정당화
```

### State Pattern — 주문 상태 전이

```
기준 1: 현재 코드가 변경에 닫혀 있는가?
→ ✅ YES — 상태 전이 규칙이 메서드 곳곳에 분산 (processOrder, cancelOrder)

기준 2: 동일한 구조적 문제가 3곳 이상?
→ 🟡 PARTIAL — 상태 처리 2곳 (processOrder, cancelOrder). Rule of Three 미달.

기준 3: 팀원이 이해하는 데 어려움?
→ ✅ YES — 허용 상태 전이 목록이 문서화되지 않음. 배송 중 취소 불가 이유가 코드상 불명확.

결론: 기준 2개 충족 → State Pattern 도입 정당화 (ARB 합의)
```

---

## 3. 리팩토링 설계도

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        OrderProcessor                            │
│              (Strangler Fig — 새 엔트리포인트)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
  │  Payment    │    │   Order     │    │  OrderEvent     │
  │  Strategy   │    │   State     │    │  Publisher      │
  │  (전략 패턴) │    │  Machine    │    │  (옵저버 패턴)   │
  └──────┬──────┘    │  (상태 패턴) │    └────────┬────────┘
         │           └─────────────┘             │
    ┌────┴────┐                         ┌────────┴────────┐
    │  Card   │                         │  EmailNotifier  │
    │ Kakao   │                         │  SmsNotifier    │
    │ Naver   │                         │  PushNotifier   │
    │Virtual  │                         └─────────────────┘
    └─────────┘
```

### 패키지 구조

```
refactored/
├── order/
│   ├── OrderProcessor.kt         (Strangler Fig 진입점)
│   ├── OrderStateMachine.kt      (State Pattern)
│   ├── OrderItem.kt              (Value Object)
│   └── OrderResult.kt            (Value Object)
├── payment/
│   ├── PaymentStrategy.kt        (Strategy Interface)
│   ├── CardPaymentStrategy.kt    (구현체)
│   ├── KakaoPayStrategy.kt       (구현체)
│   ├── NaverPayStrategy.kt       (구현체)
│   └── VirtualAccountStrategy.kt (구현체)
└── notification/
    ├── OrderEventPublisher.kt    (Publisher)
    ├── OrderEventSubscriber.kt   (Observer Interface)
    ├── EmailNotifier.kt          (구현체)
    ├── SmsNotifier.kt            (구현체)
    └── PushNotifier.kt           (구현체)
```

---

## 4. 인터페이스 설계

### PaymentStrategy

```kotlin
interface PaymentStrategy {
    fun pay(userId: String, amount: Double): PaymentResult
    val paymentMethod: String
}

data class PaymentResult(
    val success: Boolean,
    val transactionId: String,
    val errorMessage: String? = null
)
```

### OrderState

```kotlin
enum class OrderStatus {
    PENDING, PAID, SHIPPING, DELIVERED, CANCELLED, REFUNDED
}

interface OrderState {
    fun pay(): OrderState
    fun ship(): OrderState
    fun cancel(): OrderState
    val status: OrderStatus
}
```

### OrderEventSubscriber (Observer)

```kotlin
interface OrderEventSubscriber {
    fun onOrderPlaced(orderId: String, userId: String, amount: Double)
    fun onOrderCancelled(orderId: String, userId: String)
    fun onOrderShipped(orderId: String, address: String)
}
```

---

## 5. 박지수 코드 리뷰 메모 (3-30 Rule 준수)

```
[Critical 1] processOrder: God Class → Strategy+Observer 분리 필수
[Critical 2] 상태 전이: State Pattern 없으면 DELIVERED 추가 시 전체 수정
[Critical 3] 알림 결합: OrderEventPublisher 없으면 채널 추가마다 주문 코드 수정
```

> "먼저 문제를 느끼게 하라, 그러면 패턴은 저절로 보인다.  
> 이준혁이 이 코드를 리팩토링할 때 '왜 Strategy가 필요한지'를  
> 레거시 코드를 보면서 스스로 느꼈으면 합니다."

**박지수 (OOP 패턴 전문가)**
