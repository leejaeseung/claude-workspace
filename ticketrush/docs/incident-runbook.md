# TicketRush 장애 대응 런북

**버전**: v1.0  
**작성자**: 하진우 (feature-develop-developer-2)  
**작성일**: 2026-06-22 (W7)  
**리뷰**: 박지훈 (feature-develop-leader)  
**연관 ADR**: ADR-001, ADR-004, ADR-006, ADR-007, ADR-008

---

## 사전 준비

### 필수 확인 대시보드

| 대시보드 | URL | 주요 패널 |
|---------|-----|----------|
| Grafana 메인 | http://localhost:3000 | Kafka lag / JVM / HTTP P99 |
| Prometheus 알림 | http://localhost:9090/alerts | 활성 알림 목록 |
| seat-api actuator | http://localhost:8082/actuator/health | 헬스 상태 |

### 알림 심각도 기준

| 심각도 | 의미 | 대응 시간 |
|--------|------|----------|
| critical | 즉각 서비스 영향 (결제 실패, 좌석 이중 점유 위험) | 5분 이내 |
| warning | 성능 저하, 임계값 접근 | 15분 이내 |

---

## 시나리오 1: 좌석 잠금 실패 — Redis 장애

### 증상

```
알림: CircuitBreakerOpen (critical)
seat-api 로그: "redis.clients.jedis.exceptions.JedisConnectionException: Connection refused"
HTTP 409 응답 급증 (seat-api)
```

### 원인

Redis 인스턴스 다운 또는 네트워크 단절로 인해 Redis Lua 분산락 획득 실패.

### 진단

```bash
# Redis 컨테이너 상태 확인
docker compose ps redis

# Redis 연결 테스트
docker compose exec redis redis-cli ping
```

### 대응 절차

1. **즉각 조치** — Redis 컨테이너 재시작
   ```bash
   docker compose restart redis
   ```

2. **서비스 확인** — seat-api Resilience4j CB 상태 리셋 대기 (CB open duration: 10초)
   ```bash
   curl -s http://localhost:8082/actuator/circuitbreakers | jq '.circuitBreakers'
   ```

3. **좌석 상태 정합성 검증** — Redis 재시작 후 DB 좌석 상태 기준 Redis 캐시 워밍
   ```bash
   # seat-api 재시작 시 @PostConstruct 캐시 워밍 자동 실행
   # 수동 확인: GET /seats 호출 후 응답 정상 여부 체크
   curl -s http://localhost:8082/seats?showId=1 | jq '.[] | select(.status == "LOCKED")'
   ```

4. **이중 점유 확인** — Redis 장애 구간 중 LOCKED 상태 좌석 감사
   ```sql
   SELECT s.id, s.seat_number, s.status, s.order_id
   FROM seats s
   JOIN orders o ON s.order_id = o.id
   WHERE s.status = 'LOCKED'
     AND o.created_at BETWEEN '<장애 시작>' AND '<복구 시점>';
   ```

### 복구 기준

- `curl http://localhost:8082/actuator/health` → `"status": "UP"`
- Grafana CircuitBreaker 패널 CLOSED 상태 확인
- 신규 좌석 잠금 요청 성공률 > 99%

---

## 시나리오 2: Kafka Consumer Lag 급증

### 증상

```
알림: KafkaConsumerLagHigh (warning) → lag > 5,000
Grafana Kafka lag 패널에서 order.created / payment.* 파티션 급등
```

### 원인 분류

| 원인 | 진단 방법 |
|------|----------|
| max.poll.records 초과 | Consumer 로그에서 poll interval exceeded |
| HikariCP 포화 | order-api/payment-api 로그에서 connection timeout |
| Kafka broker 장애 | `docker compose ps kafka` 상태 확인 |
| Consumer Group rebalance 루프 | Consumer 로그에서 "Rebalancing" 반복 |

### 진단

```bash
# Consumer Group 상태 확인 (KRaft 모드)
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group seat-api-order

# lag 수치 확인
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group seat-api-order | grep -E "TOPIC|LAG"
```

### 대응 절차

**[Case A] max.poll.records 배치 처리 과부하**
```yaml
# infra-kafka consumer 설정 추가 조정 (ADR-006 기준값 200)
spring.kafka.consumer.max-poll-records: 100   # 추가 낮춤
```

**[Case B] HikariCP 포화**
```bash
# order-api 커넥션 풀 상태 확인 (Actuator)
curl -s http://localhost:8083/actuator/metrics/hikaricp.connections.active
```
pool 최대치 도달 시 → `maximum-pool-size` 25로 임시 상향 후 재측정.

**[Case C] Kafka broker 장애**
```bash
docker compose restart kafka
# 재시작 후 Consumer Group rebalance 완료까지 30~60초 대기
```

**[Case D] rebalance 루프**
```bash
# Consumer Group 오프셋 리셋 (마지막 정상 위치)
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group seat-api-order \
  --reset-offsets --to-latest --execute \
  --topic order.created
```

### 복구 기준

- Kafka Consumer lag < 5,000건 (ADR-006 목표)
- 60초 내 lag 회복 추세 확인 (Grafana)

---

## 시나리오 3: Circuit Breaker OPEN — 결제 실패율 급등

### 증상

```
알림: CircuitBreakerOpen (critical)
payment-api 로그: "CircuitBreaker 'paymentService' is OPEN"
payment_success_rate < 85% (k6 E2E 테스트 기준)
```

### 원인

Mock PG 응답 실패율이 50% 초과하거나 payment-api 내부 오류율 임계값 초과.

### 진단

```bash
# CB 상태 확인
curl -s http://localhost:8084/actuator/circuitbreakers | jq '.circuitBreakers.paymentService'

# payment-api 로그에서 실패 원인 분석
docker compose logs payment-api --since 5m | grep -E "ERROR|FAILED|OPEN"
```

### 대응 절차

1. **CB open duration 확인** — 기본 10초. HALF_OPEN 전환 후 자연 회복 대기.

2. **Mock PG 실패율 조정** — `application.yml`에서 임시 실패율 낮춤
   ```yaml
   mock-pg:
     failure-rate: 0.05   # 50% → 5%로 임시 조정
   ```

3. **CB 강제 리셋** (Actuator 사용)
   ```bash
   curl -X POST http://localhost:8084/actuator/circuitbreakers/paymentService/reset
   ```

4. **E2E 부하 재검증**
   ```bash
   k6 run --env PAYMENT_URL=http://localhost:8084 k6/full-flow.js --duration 30s --vus 50
   ```

### 복구 기준

- CB 상태 CLOSED
- payment_success_rate > 85% (k6 기준, ADR-007)

---

## 시나리오 4: Outbox Relay 멈춤

### 증상

```
알림: OutboxPublishingStalled (critical) → 미발행 이벤트 > 100건
order.created 토픽에 새 메시지 없음
주문 생성 후 결제 단계로 진입 불가 (사용자 대기)
```

### 원인

`OutboxRelayScheduler`가 중단됐거나 DB 연결 실패로 outbox 테이블 조회 불가.

### 진단

```bash
# order-api 스케줄러 로그 확인
docker compose logs order-api --since 5m | grep -i "outbox\|scheduler"

# outbox 테이블 미발행 건수 직접 조회
docker compose exec postgres psql -U ticketrush -c \
  "SELECT COUNT(*) FROM outbox WHERE status = 'PENDING';"
```

### 대응 절차

1. **order-api 재시작** — 스케줄러 재기동
   ```bash
   docker compose restart order-api
   ```

2. **relay 주기 확인** — ADR-008 기준 200ms 유지 여부
   ```bash
   # OutboxRelayScheduler.kt 설정값 확인
   grep -r "fixedDelay" order-api/src/
   ```

3. **outbox 적체 수동 flush** — 재시작 후 스케줄러가 자동 처리. 5분 내 PENDING → 0 확인.

4. **DB 연결 문제 시**
   ```bash
   docker compose restart postgres
   # order-api actuator/health 재확인
   curl -s http://localhost:8083/actuator/health | jq '.components.db'
   ```

### 복구 기준

- outbox `PENDING` 건수 0 또는 신규 유입 즉시 처리
- Kafka `order.created` 토픽에 새 메시지 유입 재개

---

## 시나리오 5: JVM OOM / Heap 고갈

### 증상

```
알림: JvmHeapUsageHigh (warning) → Heap > 85%
서비스 응답 지연 급증 (P99 > 2,000ms)
이후 java.lang.OutOfMemoryError 로그 또는 프로세스 종료
```

### 원인 분류

| 원인 | 특징 |
|------|------|
| 메모리 누수 | Heap 지속 증가, GC 후 회복 없음 |
| Heap 크기 부족 | 피크 트래픽 시 일시적 급등 후 GC 회복 |
| ZGC 튜닝 미흡 | ZCollectionInterval 조정 필요 |

### 진단

```bash
# JVM Heap 사용량 (Actuator)
curl -s http://localhost:8082/actuator/metrics/jvm.memory.used | jq '.measurements'

# GC 로그 확인
docker compose logs seat-api --since 10m | grep -i "gc\|heap\|memory"
```

### 대응 절차

**[Case A] Heap 크기 부족 (단기 해결)**
```yaml
# docker-compose.yml 환경변수 조정 (ADR-004 기준 유지)
environment:
  JAVA_OPTS: "-XX:+UseZGC -Xms256m -Xmx1024m"  # 768m → 1024m 임시 확장
```

**[Case B] 메모리 누수 (중장기 분석)**
```bash
# heap dump 생성
docker compose exec seat-api kill -3 1   # Thread dump
# JVM에 -XX:+HeapDumpOnOutOfMemoryError 추가 후 재배포
```

### 복구 기준

- Heap 사용률 < 70%
- P99 레이턴시 < 800ms (ADR-001 기준)

---

## 시나리오 6: DB 커넥션 포화

### 증상

```
order-api / payment-api 로그:
"HikariPool-1 - Connection is not available, request timed out after 3000ms"
HTTP 503 응답 또는 500 에러 급증
```

### 진단

```bash
# HikariCP 커넥션 상태 (Actuator)
curl -s http://localhost:8083/actuator/metrics/hikaricp.connections.pending | jq
curl -s http://localhost:8083/actuator/metrics/hikaricp.connections.active | jq

# DB 활성 커넥션 수 (PostgreSQL)
docker compose exec postgres psql -U ticketrush -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ticketrush';"
```

### 대응 절차

1. **slow query 탐지**
   ```sql
   SELECT pid, query, state, query_start, now() - query_start AS duration
   FROM pg_stat_activity
   WHERE datname = 'ticketrush' AND state != 'idle'
   ORDER BY duration DESC
   LIMIT 10;
   ```

2. **장기 실행 쿼리 강제 종료**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'ticketrush'
     AND state = 'active'
     AND now() - query_start > interval '30 seconds';
   ```

3. **HikariCP pool 임시 확장** (ADR-006 기준 20, 필요시 30)
   ```yaml
   spring.datasource.hikari.maximum-pool-size: 30
   ```

### 복구 기준

- `hikaricp.connections.pending` = 0
- order-api / payment-api HTTP 2xx 응답률 > 99%

---

## 공통 장애 대응 원칙

1. **측정 먼저** — 추측으로 설정을 변경하지 않는다. Grafana/Actuator 데이터로 원인을 확인한다.
2. **영향 범위 우선 파악** — 결제 이중화, 좌석 이중 점유 가능성부터 확인한다.
3. **롤백 기준 사전 정의** — 조치 전에 "이 지표가 개선되지 않으면 원복한다"를 명시한다.
4. **장애 후 ADR 작성** — 처음 보는 유형이면 ADR로 문서화하고 런북에 추가한다.

---

## 연락처 (시뮬레이션 환경)

| 역할 | 담당 | 비고 |
|------|------|------|
| 장애 대응 주도 | 하진우 | Kafka / 이벤트 아키텍처 |
| 인프라 / JVM 튜닝 | 박지훈 | GC / 성능 지표 |
| DB / 도메인 로직 | 강민서 | 좌석 상태 정합성 |

---

*작성: 하진우 (feature-develop-developer-2) | 2026-06-22*  
*KPI 5 "장애 대응 런북 및 모니터링 지표 정의 1건 이상 주도" 달성*
