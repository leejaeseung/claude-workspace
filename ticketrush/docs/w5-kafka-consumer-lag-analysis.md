# W5 Kafka Consumer Lag 분석 보고서

**작성자**: 하진우 (feature-develop-developer-2, 시니어)  
**작성일**: 2026-06-10 (W5)  
**대상 스프린트**: W5 (2026-06-08 ~ 2026-06-14)  
**연관 ADR**: ADR-006 (W6 성능 튜닝 종합 결과), ADR-007 (E2E 부하 테스트 전략)

---

## 1. 분석 목적

W5 부하 테스트(k6 `seat-rush.js` + `full-flow.js`) 실행 중 Kafka consumer lag이 목표치(5,000건)를 초과하는 구간이 관찰됐다. 이 보고서는 lag 발생 원인을 규명하고, 튜닝 방향을 제안한다.

---

## 2. 관찰 결과 (W5 부하 테스트 기준)

### 2.1 시나리오별 Consumer Lag 측정

| Consumer Group | 토픽 | 피크 Lag | 회복 시간 | 목표 |
|---------------|------|---------|---------|------|
| `seat-api-order` | `order.created` | **7,200건** | 95초 | < 5,000건, 60초 내 |
| `seat-api-expired` | `order.expired` | 480건 | 8초 | < 5,000건 ✅ |
| `seat-api-payment` | `payment.failed` | 220건 | 5초 | < 5,000건 ✅ |
| `order-api` | `payment.confirmed` | 310건 | 7초 | < 5,000건 ✅ |

**문제 확인**: `seat-api-order` 그룹의 `order.created` 토픽에서 피크 lag 7,200건 발생 — **목표 5,000건 초과**.

### 2.2 피크 발생 구간

```
타임라인 (full-flow.js 실행, VU 500 sustain 구간):
 T+90s  lag: 1,200
 T+120s lag: 3,800    ← ramp-up 완료 시점
 T+150s lag: 7,200    ← 피크 ⚠️
 T+180s lag: 4,100
 T+245s lag: 890      ← 회복 완료
```

---

## 3. 원인 분석

### 3.1 1차 원인 — `max.poll.records` 설정 과다

현재 `infra-kafka/KafkaConsumerConfig.kt` 설정:

```kotlin
props["max.poll.records"] = 500
props["max.poll.interval.ms"] = 300_000
```

**문제**: `OrderCreatedConsumer.onOrderCreated()`는 JPA `findById` + `save`를 호출한다. 500건 배치 처리 중 누적 처리 시간이 `max.poll.interval.ms`(5분)에 근접할 경우 consumer가 rebalance 트리거를 보내는 것이 아니라 **처리는 되지만 poll 주기가 늦어져** lag이 누적된다.

500 VU × 평균 1.2 주문/초 = **600 이벤트/초** 생성 속도.  
처리 속도: `OrderCreatedConsumer`가 DB I/O로 인해 **약 120 이벤트/초** 처리.  
→ 순유입 480 이벤트/초 → 누적 lag 발생.

### 3.2 2차 원인 — OrderCreatedConsumer DB 처리 지연

`OrderCreatedConsumer`가 단일 레코드씩 `findById` + `save`를 처리한다. 500 VU 기준 PostgreSQL 연결 수요가 HikariCP 풀(size=10)을 초과하는 순간 DB 대기 시간이 급등한다.

Grafana 관찰 데이터:
- HikariCP `pending_threads` 최대: **8**
- `findById` P99: 12ms → 89ms (피크 구간)

---

## 4. 튜닝 제안

### 4.1 단기 조치 — `max.poll.records` 감소

```kotlin
// KafkaConsumerConfig.kt 변경
props["max.poll.records"] = 100  // 500 → 100
```

**예상 효과**: 배치 크기 감소 → poll 주기 단축 → lag 회복 속도 향상.

| 설정값 | 예상 피크 lag | 회복 시간 |
|--------|-------------|---------|
| 500 (현재) | 7,200건 | 95초 |
| 100 (제안) | ~2,400건 | ~30초 |
| 50 (공격적) | ~1,200건 | ~15초 (처리량 약간 감소) |

**권장**: 100으로 조정. ADR-006 HikariCP 튜닝과 함께 적용.

### 4.2 중기 조치 — HikariCP pool size 증가

ADR-006에서 `order-api` pool size를 10 → 20으로 조정한 것과 동일하게 `seat-api` JPA 설정도 조정:

```yaml
# seat-api/application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20   # 10 → 20
      minimum-idle: 5
```

**주의**: Docker Compose 환경 PostgreSQL `max_connections`(기본 100) 초과 주의.  
5개 서비스 × 20 connections = 100 → PostgreSQL 한계에 근접.  
**최소 idle을 5로 설정**하여 실제 연결 수를 최소화한다.

### 4.3 장기 조치 — Consumer 수평 확장 검토

`order.created` 파티션 수: 현재 12개.  
Consumer 인스턴스: 현재 1개 (`seat-api` 단일 인스턴스).

3,000 RPS 목표 달성 시 단일 Consumer 처리 한계 도달 가능성:
- 3,000 RPS × 100% 전환 = 3,000 이벤트/초 생성
- `seat-api` Consumer 처리 용량: ~300 이벤트/초 (DB I/O 기준)
- 필요 Consumer 인스턴스: 최소 **10개**

> **로컬 환경 한계**: Docker Compose에서 `seat-api` 다중 인스턴스 기동은 포트 충돌 문제로  
> 별도 구성 필요. W6~W7에서 추가 검토 예정.

---

## 5. 즉시 적용 변경사항

```kotlin
// infra-kafka/src/main/kotlin/com/ticketrush/infra/kafka/KafkaConsumerConfig.kt
// 변경: max.poll.records 500 → 100 (ADR-006 HikariCP 튜닝과 동시 적용)
props["max.poll.records"] = 100
```

```yaml
# seat-api/src/main/resources/application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 3000
```

**예상 W5 재측정 결과**:
- 피크 lag: 7,200 → ~2,400건 (목표 5,000건 이하 ✅)
- 회복 시간: 95초 → ~30초 (목표 60초 이하 ✅)

---

## 6. Grafana 모니터링 체크포인트

| 패널 | 알림 기준 | 확인 방법 |
|------|----------|---------|
| `kafka_consumer_lag` | > 5,000건 / 3분 유지 | ADR-008 알림 룰 `KafkaConsumerLagHigh` |
| HikariCP `pendingThreads` | > 3 | `/actuator/metrics/hikaricp.connections.pending` |
| `seat-api` HTTP P99 | > 800ms | ADR-008 알림 룰 `HighP99Latency` |

---

*본 보고서는 하진우 KPI 5 "장애 대응 런북 및 모니터링 지표 정의 주도"의 일환으로 작성됐다.*
