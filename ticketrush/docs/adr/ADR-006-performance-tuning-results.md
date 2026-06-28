# ADR-006: W6 성능 튜닝 종합 결과

- **상태**: Accepted
- **날짜**: 2026-05-30
- **작성자**: 박지훈 (feature-develop-leader)
- **참여자**: feature-develop-leader, feature-develop-developer-1(강민서), feature-develop-developer-2(하진우)

---

## 컨텍스트

W5 부하 테스트(k6, 3,000 RPS, 100개 좌석 경합 시나리오)에서 다음 세 가지 성능 병목이 식별됐다.

### W5 기준 성능 문제점

| 문제 | 원인 | 증상 |
|------|------|------|
| G1GC STW pause | 힙 크기 비례 STW 발생 | P99 leytency 1,240ms (목표 800ms 초과) |
| HikariCP 커넥션 포화 | order-api / payment-api pool size 10 고정 | 커넥션 대기 P99 45ms, 피크 시 타임아웃 |
| Kafka consumer lag | `max.poll.records=500` 배치 처리 중 poll interval 초과 | consumer lag 피크 8,500 (목표 5,000 초과) |

G1GC STW 문제는 **ADR-004**에서 ZGC 전환 결정 및 초기 검증이 이루어졌으며, 본 ADR은 ZGC 전환 결과를 포함한 W6 성능 튜닝 세 항목의 최종 결과를 종합한다.

---

## 결정 1: ZGC 전환 (ADR-004 요약)

### 배경

G1GC는 힙 크기에 비례하는 STW pause를 발생시킨다. W5 측정 결과 P99 STW pause가 180ms에 달했고, Grafana 대시보드에서 GC pause와 HTTP P99 급등 간 명확한 correlation이 관찰됐다.

### 결정 근거

TicketRush의 핵심 제약은 **P99 < 800ms**다. ZGC는 힙 크기와 무관하게 STW pause를 1ms 이하로 유지하며, 처리량 5~10% 손실은 스케일 아웃으로 보완 가능하나 GC 유발 레이턴시 급등은 사용자 경험에 직접 영향을 미친다.

### 적용 설정

```bash
# WebFlux 서비스 (seat-api, queue-api, notification-api)
-XX:+UseZGC
-XX:ZCollectionInterval=5
-XX:ZUncommitDelay=300
-XX:+ZProactive
-Xms256m -Xmx768m

# MVC 서비스 (order-api, payment-api)
-XX:+UseZGC
-XX:ZCollectionInterval=5
-XX:ZUncommitDelay=300
-XX:+ZProactive
-Xms512m -Xmx1536m
```

### 결과

| 지표 | G1GC | ZGC | 개선율 |
|------|------|-----|--------|
| seat-api HTTP P99 | 1,240ms | 430ms | 65% 감소 |
| GC STW pause p99 | 180ms | 0.8ms | 99.6% 감소 |

---

## 결정 2: HikariCP `maximum-pool-size` 10 → 20

### 배경

order-api와 payment-api는 Spring MVC 기반 동기 블로킹 IO 서비스다. 요청 처리 스레드가 DB IO 완료까지 커넥션을 점유하므로, 동시 처리 가능한 요청 수는 pool size에 직접 제한된다. W5에서 pool size 10이 포화 상태가 되어 커넥션 대기 P99가 45ms를 기록했다.

### pool size = 20 산출 근거

동기 블로킹 IO 서비스의 적정 pool size는 아래 공식으로 근사할 수 있다.

```
pool size ≈ max concurrent requests ÷ (1 / avg query time)
          = max concurrent requests × avg query time
```

측정값:
- 목표 처리량: 3,000 RPS
- 평균 쿼리 처리 시간: 5ms (order-api INSERT + SELECT 기준)
- 동시 in-flight 요청 수 추정: 3,000 RPS × 0.005s = **15개**

안전 마진 30% 적용 → **pool size = 20**

pool size를 무한정 늘리면 DB CPU/Lock contention이 오히려 증가하므로, 측정 기반으로 최솟값을 설정하고 모니터링한다.

### 적용

```yaml
# order-api, payment-api application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 10
      connection-timeout: 3000
```

### 결과

| 지표 | 튜닝 전 | 튜닝 후 |
|------|---------|---------|
| order-api HikariCP 대기 p99 | 45ms | 12ms |

---

## 결정 3: Kafka `max.poll.records` 500 → 200

### 배경

`max.poll.records=500`으로 설정된 상태에서 consumer가 한 번의 poll에 최대 500개 레코드를 가져와 처리한다. 처리 시간이 `max.poll.interval.ms`(기본값 5분)를 초과하면 Kafka broker는 해당 consumer를 죽은 것으로 간주하여 rebalance를 트리거한다.

### 문제 발생 조건

W5 부하 테스트에서 확인된 시나리오:

1. 피크 트래픽 시 consumer가 500개 레코드를 한 번에 수신
2. 각 레코드 처리에 복잡한 비즈니스 로직(결제 검증, 좌석 상태 변경) 포함
3. 배치 전체 처리 시간이 poll interval 임박 → rebalance 위험 증가
4. rebalance 발생 시 처리 중단 → lag 급증 → 회복 과정에서 재발 악순환

### 결정 근거

`max.poll.records=200`으로 낮추면:
- 배치당 처리 시간 단축 → poll interval 초과 위험 제거
- 처리 지연이 여러 poll 사이클에 분산되어 lag 증가 속도 완화
- rebalance 없이 안정적 소비 유지

처리량은 poll 횟수 증가로 보전된다. 200은 단일 처리 배치의 평균 처리 시간(측정값 약 800ms)이 poll interval 대비 충분한 여유를 갖도록 설정한 값이다.

### 적용

```yaml
# infra-kafka consumer 설정
spring:
  kafka:
    consumer:
      max-poll-records: 200
      fetch-min-size: 1
      fetch-max-wait: 500
```

### 결과

| 지표 | 튜닝 전 | 튜닝 후 |
|------|---------|---------|
| Kafka consumer lag (peak) | 8,500 | 3,200 |

---

## 최종 성능 지표 (W6 기준)

| 지표 | 튜닝 전 (G1GC) | 튜닝 후 (ZGC + HikariCP + Kafka) | 목표 | 달성 |
|------|----------------|----------------------------------|------|------|
| seat-api HTTP P99 | 1,240ms | 430ms | < 800ms | ✅ |
| GC STW pause p99 | 180ms | 0.8ms | < 10ms | ✅ |
| Kafka consumer lag (peak) | 8,500 | 3,200 | < 5,000 | ✅ |
| order-api HikariCP 대기 p99 | 45ms | 12ms | < 20ms | ✅ |
| 3,000 RPS 에러율 | 2.3% | 0.4% | < 0.5% | ✅ |

5개 지표 전항목 목표 달성.

---

## 연관 ADR

- [ADR-004: JVM GC 전략 — G1GC → ZGC 전환](./ADR-004-jvm-zgc-tuning.md) — ZGC 전환 상세 결정 및 초기 측정
- [ADR-005: 좌석 락 G1GC 환경 재검증](./ADR-005-seat-lock-g1-resolution.md) — Redis Lua vs SELECT FOR UPDATE 1,000 RPS 비교

---

## 교훈

1. **계층적 병목 제거**: GC → DB 커넥션 → Kafka 순으로 병목을 제거했다. 하나의 병목이 제거되면 다음 병목이 드러나는 패턴을 확인.
2. **측정 기반 설정**: pool size, poll records 모두 추정식 + 실측 데이터로 근거를 확보했다. 임의값 조정은 금지.
3. **ZGC 적용 범위**: 힙 2GB 이하, JDK 21+, 레이턴시 민감 서비스에서 효과 극대화. 힙이 8GB 이상인 배치 서비스에는 G1GC 유지가 유리할 수 있다 (ADR-004 교훈 재확인).
