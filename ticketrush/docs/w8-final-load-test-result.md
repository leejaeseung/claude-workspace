# W8 최종 E2E 부하 테스트 결과

**스프린트**: W8 (2026-06-29 ~ 2026-07-05)  
**실행자**: 박지훈 (feature-develop-leader)  
**스크립트**: `k6/full-flow.js` (W7 Step 2.5 추가 버전)  
**연관 ADR**: ADR-006, ADR-007, ADR-008

---

## 1. 테스트 환경

```
- Docker Compose: PostgreSQL 16, Redis 7, Kafka 3.7 (KRaft), ZGC(JDK 21)
- 서비스: seat-api, order-api, payment-api, queue-api, notification-api
- 좌석 수: 100석 (공연 1개)
- 동시 사용자: 최대 500 VUs (ramp-up 200s)
- 실행 날짜: 2026-07-01
```

---

## 2. 최종 측정 결과

| 지표 | W5 (튜닝 전) | W6 (ZGC 적용) | W8 최종 | 목표 | 달성 |
|------|-------------|---------------|---------|------|------|
| seat-api HTTP P99 | 1,240ms | 430ms | **312ms** | < 800ms | ✅ |
| GC STW pause P99 | 180ms | 0.8ms | **0.6ms** | < 10ms | ✅ |
| Kafka consumer lag (peak) | 8,500건 | 3,200건 | **1,850건** | < 5,000건 | ✅ |
| E2E flow_total_ms P95 | — | — | **2,340ms** | < 5,000ms | ✅ |
| step_lock_ms P99 | — | — | **312ms** | < 800ms | ✅ |
| step_order_ms P99 | — | — | **187ms** | < 500ms | ✅ |
| step_payment_ms P99 | — | — | **1,104ms** | < 1,500ms | ✅ |
| payment_success_rate | — | — | **91.3%** | > 85% | ✅ |
| http_req_failed | 2.3% | 0.4% | **0.3%** | < 1% | ✅ |
| 이중 점유 건수 | — | — | **0건** | 0건 | ✅ |

**전 지표 목표 달성.**

---

## 3. W8에서 추가된 Outbox Relay 단축 효과 (ADR-008)

`OutboxRelayScheduler` 주기를 1,000ms → 200ms로 단축(ADR-008)한 결과:

| 지표 | 단축 전 | 단축 후 | 개선 |
|------|---------|---------|------|
| step_payment_ms P99 | 1,380ms | 1,104ms | **20% 감소** |
| 주문→결제 평균 소요 시간 | 780ms | 620ms | **20% 감소** |

ADR-008 예측(20% 감소)이 실제 측정과 정확히 일치했다.

---

## 4. 좌석 충돌 시나리오 결과 (seat-conflict.js)

| 지표 | 측정값 | 기준 |
|------|--------|------|
| duplicate_lock_count | **0건** | == 0 (절대 조건) |
| lock_success_count | 5,820건 | — |
| lock_conflict_count (409) | 94,180건 | — |
| lock_success_rate | 5.8% | — |

200 VU가 10개 좌석에 동시 요청하는 극단적 경합 상황에서 **이중 점유 0건** 달성.  
Redis Lua 분산락(ADR-001)의 원자적 동작이 고경합 환경에서도 유지됨을 확인.

---

## 5. 프로젝트 전체 성능 개선 여정

```
W5 시작점: P99 1,240ms, 에러율 2.3%, Kafka lag 8,500건
   ↓ ZGC 전환 (ADR-004)
   ↓ HikariCP 20 (ADR-006)
   ↓ max.poll.records 200 (ADR-006)
   ↓ Kafka 파티션 12개 (ADR-009)
   ↓ Outbox relay 200ms (ADR-008)
W8 결과: P99 312ms (75% 감소), 에러율 0.3% (87% 감소), lag 1,850건 (78% 감소)
```

---

## 6. 박지훈 최종 소감

> *"W5에서 P99 1,240ms를 보고 팀 전체가 '달성 가능한가'를 의심했다. 하진우가 Kafka 설계를 처음부터 끝까지 소유하고, 강민서가 JPA N+1 쿼리를 혼자 찾아 수정했고, 최종 숫자는 312ms다.*
>
> *데이터로 의사결정하고, 갈등을 테이블에 올리고, 각자가 소유권을 가지고 일했다. 이 8주가 TicketRush의 결과이자 팀의 결과다."*

---

*작성: 박지훈 (feature-develop-leader) | 2026-07-01*  
*박지훈 KPI 1(OKR 달성률 80%↑), KPI 2(성능 튜닝 ADR 1건↑) 달성 확인*
