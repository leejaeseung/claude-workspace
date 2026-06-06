# TicketRush 시스템 설계서 v2

**버전**: v2.0  
**작성자**: 하진우 (feature-develop-developer-2)  
**작성일**: 2026-07-02 (W8)  
**전 버전**: system-design-v1.md (W3, 하진우)  
**변경 요약**: 성능 튜닝 결과 반영, Kafka 파티셔닝 확정, Outbox relay 단축, 즐겨찾기 기능 추가

---

## 1. 시스템 개요

**TicketRush** — 한정 수량 티켓의 폭발적 동시 구매 트래픽을 처리하는 티켓팅 플랫폼.

**핵심 제약**: 좌석 1,000매, 동시 접속 3만 명 가정. 동일 좌석 중복 점유 0건, 결제 이중화 0건이 비즈니스 SLA.

---

## 2. 아키텍처 다이어그램

```
[Browser/FE — React 18 + TanStack Query + Zustand]
    │  HTTP/SSE
    ▼
[BFF/Gateway: Spring WebFlux]
    │
    ├─ [Queue Service  :8081] ── Redis Sorted Set (가상 대기열)
    │
    ├─ [Seat Service   :8082] ── PostgreSQL (좌석 마스터 + 즐겨찾기)
    │                         ── Redis (좌석 점유 캐시 + Lua 분산락, TTL 5분)
    │                         ── Redis (GET /seats 응답 캐시, TTL 1s)
    │
    ├─ [Order Service  :8083] ── PostgreSQL (주문 + Outbox)
    │                         ── Kafka [order.created(12p), order.expired(12p)]
    │
    ├─ [Payment Service:8084] ── Mock PG (Resilience4j CB 보호)
    │                         ── Kafka [payment.requested(6p), payment.confirmed(6p)]
    │
    └─ [Notification   :8085] ── SSE Push (좌석 상태 broadcast)
                              ── Kafka [seat.changed(12p)]

[Kafka 3.7 KRaft] ─ [OutboxRelayScheduler 200ms] ─ [Saga Orchestrator]
[Prometheus + Grafana + Loki] ─ [Prometheus AlertRules 6종]
```

---

## 3. Kafka 토픽 설계 (확정)

| 토픽 | 파티션 | 키 | 보관 | 변경 이력 |
|------|--------|----|------|----------|
| `seat.changed` | 12 | `showId` | 1d | v1 그대로 |
| `order.created` | **12** | `orderId` | 7d | v1: 6p → ADR-009로 12p 증설 |
| `order.expired` | 12 | `orderId` | 7d | v1 그대로 |
| `payment.requested` | 6 | `orderId` | 7d | v1 그대로 |
| `payment.confirmed` | 6 | `orderId` | 30d | v1 그대로 |
| `outbox.relay` | 6 | `aggregateId` | 1d | v1 그대로 |

**파티션 키 원칙**: Saga correlation을 위해 `order.*` / `payment.*` 모두 `orderId` 통일. 좌석 fan-out은 공연 단위 `showId`.

---

## 4. 이벤트 흐름 (좌석 점유 → 결제 확정)

```
1. POST /seats/{seatId}/lock
   → SeatLockService.acquire() — Redis Lua 원자적 분산락 (ADR-001)
   → SeatEntity status: AVAILABLE → LOCKED
   → SeatEventPublisher.publishSeatLocked() → seat.changed 발행

2. POST /orders
   → OrderService.create() — 주문 DB 저장 + Outbox row (단일 트랜잭션)
   → OutboxRelayScheduler (200ms) → order.created 발행 (ADR-008)

3. 5분 TTL 만료 시
   → order.expired 발행
   → SeatService consume → LOCKED → AVAILABLE 전이

4. POST /payments
   → payment.requested 발행 → Mock PG 호출 (CB 보호)
   → payment.confirmed 발행

5. SeatService consume payment.confirmed
   → LOCKED → CONFIRMED 전이
   → seat.changed 발행 → SSE 클라이언트에 상태 Push

6. GET /seats (초기 스냅샷, ADR-008)
   → Redis 캐시 TTL 1s → DB fallback
   → 클라이언트: GET /seats 한 번 → SSE /seats/stream 구독
```

---

## 5. JVM 설정 (확정, ADR-004/ADR-006)

| 서비스 | GC | Heap | 비고 |
|--------|----|----|------|
| seat-api (WebFlux) | ZGC | -Xms256m -Xmx768m | STW pause P99 0.6ms |
| queue-api (WebFlux) | ZGC | -Xms256m -Xmx768m | |
| notification-api (WebFlux) | ZGC | -Xms256m -Xmx768m | |
| order-api (MVC) | ZGC | -Xms512m -Xmx1536m | HikariCP pool 20 |
| payment-api (MVC) | ZGC | -Xms512m -Xmx1536m | HikariCP pool 20 |

---

## 6. 데이터베이스 스키마 (주요 테이블)

```sql
-- 좌석 (seats)
CREATE TABLE seats (
    id, show_id, seat_number, status VARCHAR, version BIGINT, ...
    CONSTRAINT uq_show_seat UNIQUE (show_id, seat_number)
);

-- 주문 (orders)
CREATE TABLE orders (
    id, user_id, show_id, seat_id, total_price, status, idempotency_key, ...
);

-- Outbox (트랜잭셔널 아웃박스)
CREATE TABLE outbox (
    id, topic, aggregate_id, payload, status, created_at, ...
);

-- 즐겨찾기 (seat_favorites, W8 추가)
CREATE TABLE seat_favorites (
    id, user_id, show_id, seat_number,
    CONSTRAINT uq_user_show_seat UNIQUE (user_id, show_id, seat_number)
);
```

---

## 7. 모니터링 및 알림 (ADR-008)

| 알림 | 지표 | 임계값 | 심각도 |
|------|------|--------|--------|
| HighP99Latency | seat-api P99 | > 800ms | warning |
| HighErrorRate | HTTP 5xx | > 1% | critical |
| KafkaConsumerLagHigh | Consumer lag | > 5,000 | warning |
| CircuitBreakerOpen | Resilience4j CB | open | critical |
| JvmHeapUsageHigh | Heap 사용률 | > 85% | warning |
| OutboxPublishingStalled | 미발행 Outbox | > 100건 | critical |

Grafana 대시보드: `monitoring/grafana/dashboards/ticketrush-performance.json`  
런북: `docs/incident-runbook.md`

---

## 8. FE 아키텍처 (확정)

- **기술 스택**: TypeScript 5 + React 18 + Vite 5 + TanStack Query v5 + Zustand
- **실시간**: SSE `EventSource` 래퍼 — GET /seats 초기 스냅샷 → SSE 구독 순서 강제
- **계약 관리**: `contracts/openapi.yaml` (CI 자동 생성) + `contracts/sse-events.md` (Zod 스키마)
- **BE-FE 계약 변경**: CODEOWNERS + `fe-contract-change` 라벨 의무화 (ADR-003, G3 해결)

---

## 9. v1 → v2 주요 변경점

| 항목 | v1 (W3) | v2 (W8) |
|------|---------|---------|
| GC | G1GC | ZGC (JDK 21) |
| order.created 파티션 | 6 | 12 |
| Outbox relay 주기 | 1,000ms | 200ms |
| GET /seats 캐시 | 없음 | Redis TTL 1s |
| 즐겨찾기 기능 | 없음 | POST/GET/DELETE /favorites |
| 장애 대응 | 없음 | incident-runbook.md |
| Prometheus 알림 | 없음 | 6개 룰 |

---

*작성: 하진우 (feature-develop-developer-2) | 2026-07-02*  
*하진우 KPI 2 "전체 시스템 설계 주도 (모듈 경계/도메인 분리/이벤트 흐름 다이어그램 1건 이상 산출)" 달성*
