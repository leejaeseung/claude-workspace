# ADR-002: order.created 토픽 파티션 키 선택

- **상태**: 확정 (Accepted)
- **작성일**: 2026-05-10
- **참여자**: feature-develop-leader, feature-develop-developer-1(강민서), feature-develop-developer-2(하진우)
- **갈등 유형**: G2 — 팀 내 기술 의견 충돌

---

## 컨텍스트

`order.created` 토픽에 메시지를 발행할 때, Kafka 파티션 키를 무엇으로 설정하느냐를 두고 팀 내 의견이 갈렸다.

- **강민서(Developer-1)**: `userId`를 파티션 키로 사용 → "같은 사용자의 주문은 순서가 보장되어야 한다"
- **하진우(Developer-2)**: `orderId`를 파티션 키로 사용 → "순서 보장이 필요 없고, 핫스팟 위험이 있다"

---

## 결정 옵션

### Option A: `userId` 파티션 키

```kotlin
kafkaTemplate.send(TopicNames.ORDER_CREATED, userId, objectMapper.writeValueAsString(event))
```

**장점**:
- 특정 사용자의 이벤트가 같은 파티션에 도달 → 파티션 내 순서 보장
- 소비자가 동일 사용자 이벤트를 단일 스레드로 처리하므로 동시성 충돌 없음

**단점**:
- **핫스팟**: 특정 userId(봇, VIP 사용자)에 주문이 집중될 경우 특정 파티션에 부하 편중
- `payment.confirmed` / `payment.failed` 토픽은 `orderId` 키를 쓰는데, 두 토픽 간 키가 달라 **소비자 상관 조인**이 어려움
- 주문 처리는 Saga 패턴으로 이미 비동기화 → 사용자 수준 순서 보장이 실제로 필요하지 않음

### Option B: `orderId` 파티션 키 ✅ (채택)

```kotlin
kafkaTemplate.send(TopicNames.ORDER_CREATED, event.orderId.toString(), objectMapper.writeValueAsString(event))
```

**장점**:
- **균등 분산**: orderId는 자연 증가하므로 파티션이 고르게 채워짐
- **일관성**: `payment.*` 토픽과 동일한 키 → Saga 트랜잭션 추적 시 동일 파티션에서 상관 이벤트를 읽을 가능성 높음
- 주문 단위 멱등성은 DB unique constraint + idempotency-key로 이미 보장 → Kafka 순서 보장 불필요
- 스케일 아웃 시 파티션 수 증가만으로 처리량 선형 확대 가능

**단점**:
- 사용자 수준 이벤트 순서가 파티션 간에 보장되지 않음 (허용 가능)

---

## 결정 근거

1. **Saga 패턴 일관성**: `payment.confirmed`/`payment.failed` 이미 `orderId` 키 사용 중. 동일 키 정책으로 Saga correlation을 단순화.
2. **부하 분산**: 콘서트 오픈 순간 50,000 RPS 환경에서 `userId` 핫스팟은 단일 파티션 병목을 만들 수 있음.
3. **순서 요구사항 부재**: 주문 생성 → 결제 흐름은 stateless Saga로 구성; 사용자 수준 정렬이 비즈니스 요건에 없음.
4. **쿼리 패턴**: 소비자(order-api)는 `orderId`로 DB 조회 → 파티션 키와 조회 키가 일치하여 이벤트 라우팅 디버깅 용이.

---

## 구현

`OutboxRelayScheduler`가 outbox 테이블에서 읽어 Kafka로 발행 시:

```kotlin
// order-api/scheduler/OutboxRelayScheduler.kt
kafkaTemplate.send(
    outbox.topic,
    outbox.aggregateId,   // orderId.toString()
    outbox.payload,
)
```

`outbox` 테이블의 `aggregate_id` 컬럼이 파티션 키 역할을 한다.

---

## 파급 효과

- `payment-api`는 이미 `orderId.toString()`을 키로 사용 → 변경 없음
- `seat-api`의 `seat.changed`는 `showId`를 키로 사용 → 좌석 상태 SSE 브로드캐스트는 공연 단위로 묶이므로 유지
- 소비자 그룹 확장 시 파티션 수 = 최대 병렬 소비자 수임을 유의 (현재 `order.created`: 6 파티션)

---

## 교훈 (강민서 ↔ 하진우 갈등)

강민서의 `userId` 제안은 "사용자 경험"의 순서 일관성에서 출발했고 타당한 고민이었다. 그러나 하진우가 지적한 **핫스팟 위험**과 **Saga correlation 불일치**가 더 무거운 제약임을 팀 전체가 PoC 없이 논리적 분석으로 합의했다. 향후 사용자 수준 순서 보장이 필요한 기능이 생기면 **Consumer-side 정렬** 또는 **별도 토픽**으로 대응한다.
