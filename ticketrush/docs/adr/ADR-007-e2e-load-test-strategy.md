# ADR-007: E2E 전체 플로우 부하 테스트 전략

- **상태**: Accepted
- **날짜**: 2026-05-30
- **참여자**: feature-develop-leader(박지훈), feature-develop-developer-1(강민서), feature-develop-developer-2(하진우)

---

## 컨텍스트

W5~W6에서 실시한 단위 부하 테스트는 개별 서비스를 독립적으로 검증했다.

| 스크립트 | 대상 | 지표 |
|---------|------|------|
| `seat-rush.js` | seat-api 좌석 잠금 | P99 < 800ms @ 3,000 RPS |
| `g1-lock-comparison.js` | Redis Lua vs SELECT FOR UPDATE | P99 비교 @ 1,000 RPS |

그러나 실제 사용자 경험은 단일 서비스가 아닌 **대기열 진입 → 좌석 잠금 → 주문 생성 → 결제**의 4단계 Saga 흐름 전체에 걸쳐 있다. 개별 서비스가 목표를 달성하더라도 서비스 간 연쇄 지연(Kafka outbox relay 대기, DB 커넥션 경합, 네트워크 홉)이 E2E 레이턴시에 영향을 줄 수 있다.

---

## 결정: full-flow.js E2E 통합 부하 테스트

**스크립트**: `k6/full-flow.js`

### 부하 프로파일

| 단계 | 시간 | 목표 VUs |
|------|------|---------|
| ramp-up 1 | 30s | 100 |
| ramp-up 2 | 60s | 300 |
| ramp-up 3 | 60s | 500 |
| sustain | 30s | 500 |
| ramp-down | 20s | 0 |

총 실행 시간: 200초, 최대 500 VUs

### 4단계 플로우

```
Step 1: POST /queue/enter          → position 획득
  ↓ sleep(position * 50ms, max 2s)
Step 2: POST /seats/{seatId}/lock  → seatId 확정
Step 2.5: POST /orders             → orderId 획득 (실제 API)
Step 3: POST /payments             → 결제 완료
```

W7 이전까지 Step 3에서 Mock orderId(`__VU * 10000 + __ITER`)를 사용하고 있었다. W7에서 Step 2.5를 추가하여 실제 order-api를 호출하도록 수정했다.

### Thresholds

| 지표 | 기준 | 의미 |
|------|------|------|
| `flow_total_ms` p(95) | < 5,000ms | E2E 전체 흐름 95th percentile |
| `step_lock_ms` p(99) | < 800ms | 좌석 잠금 P99 (ADR-001 기준 일치) |
| `step_order_ms` p(99) | < 500ms | 주문 생성 P99 |
| `step_payment_ms` p(99) | < 1,500ms | 결제 P99 (PG 레이턴시 포함) |
| `payment_success_rate` | > 85% | 경합 환경 + PG 실패율 반영 |
| `http_req_failed` | < 1% | 전체 HTTP 에러율 |

---

## 예상 결과

| 지표 | 예상값 | 목표 |
|------|--------|------|
| flow_total_ms P95 | ~3,500ms | < 5,000ms ✅ |
| step_queue_ms P99 | ~120ms | — |
| step_lock_ms P99 | ~450ms | < 800ms ✅ |
| step_order_ms P99 | ~200ms | < 500ms ✅ |
| step_payment_ms P99 | ~800ms | < 1,500ms ✅ |
| payment_success_rate | ~88% | > 85% ✅ |
| http_req_failed | ~0.4% | < 1% ✅ |

---

## 병목 시나리오 및 대응

### 시나리오 1: Outbox relay 지연이 결제 레이턴시에 반영

`OutboxRelayScheduler`는 1초마다 실행된다. 주문 생성 직후 결제를 요청하면 payment-api가 `order.created` 이벤트를 수신하기까지 최대 1초의 relay 지연이 발생한다.

**대응**: relay 주기를 1,000ms → 200ms로 단축하면 `step_payment_ms` P99 약 20% 감소 예상. 단, 빈 폴링 빈도 증가(CPU 미미한 상승)를 허용해야 한다.

```kotlin
// OutboxRelayScheduler.kt
@Scheduled(fixedDelay = 200)  // 1000 → 200
```

### 시나리오 2: 대기열 적체로 flow_total_ms 급등

`position`에 비례한 sleep이 최대 2초이므로, 대기열 크기가 40 이상이면 2초 고정 대기로 E2E 시간이 크게 늘어난다. 실제 콘서트 오픈 환경에서는 admit 처리량(초당 입장 허용 수)이 핵심 조정 변수다.

### 시나리오 3: 결제 CircuitBreaker OPEN

Mock PG 실패율이 50% 초과 시 CB가 OPEN되어 10초간 모든 결제가 즉시 실패한다. 이때 `payment_success_rate`가 급락하여 threshold를 위반할 수 있다. CB open duration(현재 10s) 조정이나 PG 실패율 조정으로 완화한다.

---

## 실행 방법

```bash
k6 run \
  --env QUEUE_URL=http://localhost:8081 \
  --env SEAT_URL=http://localhost:8082 \
  --env ORDER_URL=http://localhost:8083 \
  --env PAYMENT_URL=http://localhost:8084 \
  k6/full-flow.js
```

결과 파일: `k6/results/full-flow-summary.json`

---

## 연관 ADR

- ADR-001: 좌석 잠금 전략 (Redis Lua) — step_lock_ms threshold 기준
- ADR-004: ZGC 튜닝 — GC pause가 각 step 레이턴시에 미치는 영향 완화
- ADR-006: W6 성능 최적화 — HikariCP pool, Kafka consumer 튜닝 결과 반영
- ADR-007 (본 문서): E2E 통합 테스트로 개별 튜닝 효과 종합 검증
