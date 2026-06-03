# W5 부하 테스트 1차 실행 런북

**스프린트**: W5 (2026-06-08 ~ 2026-06-14)  
**담당**: 박지훈(실행/분석), 강민서+하진우(공동 관찰)  
**관련 ADR**: ADR-001, ADR-004, ADR-005, ADR-006, ADR-007

---

## 0. 사전 체크리스트

```bash
# 1. Docker Compose 기동 확인
docker compose ps   # postgres, redis, kafka, prometheus, grafana 모두 Up

# 2. 서비스 헬스 확인
curl -s http://localhost:8081/actuator/health | jq .status   # queue-api
curl -s http://localhost:8082/actuator/health | jq .status   # seat-api
curl -s http://localhost:8083/actuator/health | jq .status   # order-api
curl -s http://localhost:8084/actuator/health | jq .status   # payment-api
curl -s http://localhost:8085/actuator/health | jq .status   # notification-api

# 3. JVM 옵션 확인 (ZGC — ADR-004)
# 각 서비스 시작 시 다음 JVM 옵션 적용 필요:
# -XX:+UseZGC -Xms512m -Xmx1g -XX:ZCollectionInterval=100

# 4. 테스트 DB 초기화 (좌석 100개 INSERT)
# seat-api migration이 완료되면 자동 생성됨 (V1__init_seat_schema.sql)
```

---

## 1. 시나리오 A — 좌석 잠금 집중 부하 (seat-rush.js)

### 목표
- P99 < 800ms @ 3,000 RPS (ADR-001 SLO)
- 동일 좌석 중복 점유 0건

### 실행
```bash
docker compose run --rm k6 run \
  --env BASE_URL=http://seat-api:8082 \
  /scripts/seat-rush.js
```

### 단계별 부하 프로파일
| 단계 | 시간 | RPS |
|------|------|-----|
| ramp-up | 30s | 100 → 1,000 |
| 목표 도달 | 60s | 1,000 → 3,000 |
| sustain | 30s | 3,000 |
| ramp-down | 10s | 0 |

### 관찰 지표 (Grafana)
- `http_req_duration{p99}` (seat-api) → 목표: < 800ms
- ZGC STW pause P99 → 목표: < 10ms (ADR-004)
- `seat_lock_success_rate` → 경합 환경 기준: ≥ 30%

---

## 2. 시나리오 B — G1 갈등 비교 (g1-lock-comparison.js)

### 목표
- Redis Lua P99 ≤ DB P99 × 0.5 → ADR-001 결정 재확인

### 사전 조건
- [x] `POST /seats/{seatId}/lock-db` 구현 완료 (SeatController.lockWithDb, 2026-06-03)
- [x] `SeatLockService.acquireWithDbLock()` Websocket 환경 검증

### 실행
```bash
docker compose run --rm k6 run \
  --env BASE_URL=http://seat-api:8082 \
  /scripts/g1-lock-comparison.js
```

### 판정 기준 (ADR-005)
| 조건 | 결과 |
|------|------|
| Redis P99 ≤ DB P99 × 0.5 | ADR-001 결정 유지 확인 |
| Redis P99 > DB P99 × 0.5 | 재논의 → 신규 ADR |

### 결과 파일
```
k6/results/g1-lock-comparison-summary.json
```

---

## 3. 시나리오 C — E2E 플로우 통합 (full-flow.js)

### 목표
- 전체 플로우 P95 < 5s
- 결제 성공률 ≥ 85% (Mock PG 90% 반영)

### 실행
```bash
docker compose run --rm k6 run \
  --env QUEUE_URL=http://queue-api:8081 \
  --env SEAT_URL=http://seat-api:8082 \
  --env ORDER_URL=http://order-api:8083 \
  --env PAYMENT_URL=http://payment-api:8084 \
  /scripts/full-flow.js
```

### VU 프로파일
| 단계 | 시간 | VU |
|------|------|-----|
| ramp-up | 30s | 100 |
| 증가 | 60s | 300 |
| 추가 | 60s | 500 |
| sustain | 30s | 500 |
| ramp-down | 20s | 0 |

### Kafka consumer lag 관찰 (하진우 담당)
```bash
# kafka-consumer-groups.sh 로 lag 확인
docker exec ticketrush-kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group seat-api-order \
  --describe
```
- 목표: 피크 lag < 5,000건, 60초 내 회복 (ADR-007)

---

## 4. 결과 분석 체크리스트

### 박지훈 (리더)
- [ ] seat-rush P99 측정값 기록
- [ ] G1 비교 결과 판정 (ADR-005 기준)
- [ ] ZGC vs G1GC 성능 비교 값 ADR-006에 추가 기재

### 하진우
- [ ] Kafka consumer lag 그래프 스크린샷
- [ ] HikariCP 커넥션 포화 여부 확인 (ADR-006 튜닝 결과 검증)
- [ ] full-flow 결과를 시스템 설계서 v1에 반영할 항목 식별

### 강민서
- [ ] G1 비교 결과를 팀에 발표 준비 (G1 갈등 조율 프로세스 v1 — KPI 3)
- [ ] 부하 테스트 중 결제 결과 화면 정상 동작 확인

---

## 5. 문제 발생 시 대응

| 증상 | 확인 항목 | 대응 |
|------|-----------|------|
| P99 > 800ms | ZGC pause, HikariCP pool | `-Xmx` 증가 또는 pool size 조정 |
| Kafka lag 미회복 | `max.poll.records` 설정 | 100으로 감소 (ADR-006 참고) |
| 중복 점유 발생 | Redis lua 원자성 로그 | 즉시 테스트 중단, seat-api 재시작 |
| CB OPEN (payment-api) | `resilience4j.circuitbreaker` 메트릭 | 10초 후 HALF_OPEN 자동 복구 대기 |

---

## 6. 관련 Grafana 대시보드

| 대시보드 | 확인 내용 |
|---------|---------|
| `ticketrush-jvm` | ZGC pause, heap 사용률 |
| `ticketrush-kafka` | consumer lag, producer throughput |
| `ticketrush-http` | P99 응답시간, 에러율 |
| `ticketrush-circuit-breaker` | CB 상태, resilience4j 메트릭 |

Grafana URL: http://localhost:3000
