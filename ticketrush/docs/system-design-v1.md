# TicketRush System Design v1

작성일: 2026-05-30  
작성자: 하진우 (feature-develop-developer-2)  
리뷰: 박지훈 팀 리더

---

## 1. 개요

TicketRush는 고트래픽 환경에서 콘서트/공연 티켓 예매를 처리하는 MSA 기반 시스템입니다.  
핵심 설계 목표는 **좌석 중복 점유 방지**, **이벤트 흐름 추적성 보장**, **Redis 장애 시 DB 보정 가능성**입니다.

---

## 2. 서비스 구성

| 서비스 | 역할 |
|--------|------|
| `queue-api` | 대기열 진입/순번 관리 |
| `seat-api` | 좌석 잠금(Redis) + 상태 관리(DB) |
| `order-api` | 주문 생성 및 만료 처리 |
| `payment-api` | 결제 요청/확인/실패 처리 |
| `notification-api` | SSE 기반 실시간 좌석 상태 브로드캐스트 |

---

## 3. 좌석 상태 전이

```
AVAILABLE
    │
    │ POST /seats/{id}/lock  (SeatLockService.acquire → Redis SETNX)
    │   ※ DB 상태는 아직 AVAILABLE — Redis만 잠김
    │
    │ order.created  (OrderCreatedConsumer)
    │   → DB 상태 LOCKED + orderId 기록
    ▼
  LOCKED
    │
    ├─► order.expired  → AVAILABLE  (OrderExpiredConsumer)
    ├─► payment.failed → AVAILABLE  (PaymentFailedConsumer)
    │
    │ payment.confirmed
    ▼
CONFIRMED
```

> 주의: Redis 잠금(`POST /lock`)과 DB LOCKED 전이(`order.created`)는 별도 단계입니다.
> `order.created` 처리 전에 `order.expired`가 도달하면 `findByOrderId()` 결과가 null일 수 있습니다.
> 이 경우 Redis TTL 만료로 자동 해제되므로 실질적 영향은 없으나, 운영 모니터링 시 인지 필요합니다.

### DB 상태 vs Redis 락 관계

| DB 상태 | Redis 락 | 의미 |
|---------|----------|------|
| AVAILABLE | 없음 | 선택 가능 |
| AVAILABLE | 있음 | 비정상 (TTL 만료 대기 중) |
| LOCKED | 있음 | 정상 점유 |
| LOCKED | 없음 | Redis TTL 만료, 보정 필요 |
| CONFIRMED | 없음 | 결제 완료 |

---

## 4. 이벤트 흐름

```
[사용자]
  │
  │ POST /seats/{id}/lock
  ▼
[seat-api] ──seat.changed(LOCKED)──► [notification-api] ──SSE──► [browser]
  │  (Redis에만 잠금 기록, DB는 아직 AVAILABLE)

[order-api] ──order.created──► [seat-api: OrderCreatedConsumer]
  │                               └─ DB LOCKED 전이 + orderId 저장
  │
  └──────────────────────────► [payment-api]
                │
                └──► (만료 타이머)
                       │ order.expired
                       ▼
              [seat-api: OrderExpiredConsumer]
                       │ findByOrderId → Redis 해제 → DB AVAILABLE
                       ▼
              seat.changed(AVAILABLE) ──► [notification-api]

[payment-api] ──payment.confirmed──► [seat-api: PaymentConfirmedConsumer]
  │                                     └─ DB CONFIRMED + seat.changed(CONFIRMED) ──► [notification-api]
  │
  └──────────── payment.failed ──► [seat-api: PaymentFailedConsumer]
                                     └─ findByOrderId → Redis 해제 → DB AVAILABLE
                                        seat.changed(AVAILABLE) ──► [notification-api]
```

---

## 5. Kafka 컨슈머 그룹 설계

| Consumer 클래스 | 토픽 | groupId | 비고 |
|----------------|------|---------|------|
| `OrderCreatedConsumer` | `order.created` | `seat-api-order` | DB LOCKED 전이 + orderId 저장 |
| `PaymentConfirmedConsumer` | `payment.confirmed` | `seat-api` | CONFIRMED 전이 + orderId 최종 확인 |
| `OrderExpiredConsumer` | `order.expired` | `seat-api-expired` | 기존 stub과 groupId 충돌 방지 |
| `PaymentFailedConsumer` | `payment.failed` | `seat-api-payment` | 독립 소비 그룹 |

> 첫 배포 시 새 groupId들(`seat-api-order`, `seat-api-expired`, `seat-api-payment`)은
> Kafka broker의 `auto.offset.reset` 설정을 따릅니다. 기본값이 `latest`라면 배포 전
> in-flight 이벤트가 스킵될 수 있으므로 `earliest`로 설정하거나 오프셋을 수동 지정하세요.

---

## 6. SeatEntity.orderId 도입 이유 (옵션 A 선택 근거)

`OrderExpiredEvent`와 `PaymentFailedEvent`는 `orderId`만 포함하며 `seatId`/`showId`를 포함하지 않습니다.  
따라서 `SeatEntity`에 `orderId`를 저장해두지 않으면 이벤트 수신 시 좌석을 역추적할 수 없습니다.

**대안 검토**:
- **옵션 B** (order-api에서 seatId 포함): 이벤트 컨트랙트 변경 필요, 팀 간 의존성 증가
- **옵션 C** (별도 매핑 테이블): 조인 오버헤드 및 관리 복잡도 증가

**결론**: `SeatEntity.orderId` 추가가 도메인 모델상 자연스럽고 이벤트 흐름 추적성이 가장 높습니다.

---

## 7. 멱등성 처리

- `PaymentConfirmedConsumer`: 이미 `CONFIRMED` 상태면 중복 처리 건너뜀
- `OrderExpiredConsumer`: 이미 `CONFIRMED` 상태면 무시 (이벤트 순서 역전 방어)
- `PaymentFailedConsumer`: 이미 `CONFIRMED` 상태면 경고 로그 후 무시

---

## 8. Redis 장애 대응

Redis 장애 시 좌석 잠금 정보 유실 가능성이 있습니다.  
`order.expired` / `payment.failed` 이벤트 도착 시 Redis 락이 없어도 DB 상태(`AVAILABLE` 전이)는 정상 처리됩니다.  
`getOwner()`가 `null`을 반환하면 Redis 해제를 건너뛰고 DB만 보정합니다.

---

## 9. 관련 ADR

- [ADR-001: 좌석 잠금 전략](./adr/ADR-001-seat-lock-strategy.md)
- [ADR-002: Kafka 파티션 키](./adr/ADR-002-kafka-partition-key.md)
