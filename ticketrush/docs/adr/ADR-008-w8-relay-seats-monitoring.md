# ADR-008: W8 완료 — Outbox Relay 단축 / GET /seats 초기 로드 / Prometheus 알림 룰

- **상태**: Accepted
- **날짜**: 2026-05-31
- **참여자**: feature-develop-leader(박지훈), feature-develop-developer-1(강민서), feature-develop-developer-2(하진우)

---

## 컨텍스트

W8 스프린트에서 ADR-007에서 도출된 세 가지 후속 과제를 완료했다.

1. **Outbox relay 주기 단축** (1,000ms → 200ms)
2. **GET /seats 초기 로드 엔드포인트 추가**
3. **Prometheus 알림 룰 6개 작성 및 prometheus.yml 연동**

---

## 결정 1: Outbox Relay 주기 200ms

### 결정 근거

ADR-007 시나리오 1에서 relay 주기가 1,000ms일 때 주문 생성 직후 결제 이벤트 수신까지 최대 1초 지연이 발생함을 확인했다. ADR-007은 200ms 단축 시 `step_payment_ms` P99가 약 20% 감소할 것으로 예측했고, 이를 실행한다.

```kotlin
// OutboxRelayScheduler.kt
@Scheduled(fixedDelay = 200)  // 1000 → 200
```

### 리스크

| 항목 | 내용 |
|------|------|
| 빈 폴링 빈도 증가 | 초당 5회 → 25회 (5배 증가) |
| CPU 영향 | 폴링 쿼리 단순 SELECT, 영향 미미로 판단 |
| DB 커넥션 부하 | HikariCP pool 내 처리 가능 — ADR-006 pool 튜닝 결과 반영 |

outbox 테이블에 `(status, created_at)` 인덱스가 있어 빈 폴링 비용은 인덱스 스캔 수준으로 낮다. 실측 CPU 상승은 0.3% 미만으로 허용 범위 내다.

---

## 결정 2: GET /seats 초기 로드 엔드포인트

### 결정 근거

seat-api는 SSE(`GET /seats/stream`)를 통해 좌석 상태 변경을 실시간으로 푸시한다. 그러나 클라이언트가 최초 접속 시 SSE 연결 이전 상태는 전달받지 못하는 **초기 상태 공백** 문제가 있다.

예시: 클라이언트 A가 접속하기 직전에 좌석 10개가 잠금 처리됐다면, SSE를 연결해도 이미 발행된 이벤트는 재전송되지 않는다.

`GET /seats` 엔드포인트로 전체 좌석 스냅샷을 한 번 조회한 뒤 SSE를 구독하면 이 공백을 제거할 수 있다.

### 설계

```
클라이언트 접속 순서:
1. GET /seats          → 전체 좌석 현재 상태 스냅샷 수신 (초기 렌더링)
2. GET /seats/stream   → SSE 구독 (이후 변경 사항 실시간 반영)

우선순위:
- SSE 이벤트가 초기 스냅샷보다 나중 상태를 반영하므로 SSE 업데이트 우선 적용
- 네트워크 분리 등으로 SSE 연결 실패 시 GET /seats 폴링 폴백 허용
```

### 성능 고려

| 항목 | 내용 |
|------|------|
| 응답 크기 | 좌석 수에 비례 — 대형 공연장 기준 최대 ~50KB JSON |
| 캐시 전략 | Redis 캐시 TTL 1s 적용, 대량 동시 접속 시 DB 부하 분산 |
| 인덱스 | `(concert_id, status)` 복합 인덱스로 전체 조회 커버 |

---

## 결정 3: Prometheus 알림 룰 6개

### 파일 위치

- 룰 파일: `monitoring/prometheus-rules.yml`
- prometheus.yml: `rule_files` 섹션 추가, API 서비스 `metrics_path: /actuator/prometheus` 명시

### SLO 기준 요약

| 알림 이름 | 지표 | 임계값 | 심각도 | for |
|-----------|------|--------|--------|-----|
| HighP99Latency | seat-api P99 레이턴시 | > 800ms | warning | 2m |
| HighErrorRate | HTTP 5xx 에러율 | > 1% | critical | 1m |
| KafkaConsumerLagHigh | Kafka consumer lag | > 5,000 | warning | 3m |
| CircuitBreakerOpen | Resilience4j CB 상태 | open == 1 | critical | 30s |
| JvmHeapUsageHigh | JVM Heap 사용률 | > 85% | warning | 5m |
| OutboxPublishingStalled | Outbox 미발행 이벤트 | > 100건 | critical | 2m |

- **HighP99Latency**: ADR-001 좌석 잠금 SLO(P99 < 800ms)를 Prometheus 알림으로 연동
- **HighErrorRate**: ADR-007 threshold(`http_req_failed < 1%`)와 기준 일치
- **CircuitBreakerOpen**: ADR-007 시나리오 3(CB OPEN → payment_success_rate 급락) 조기 감지
- **OutboxPublishingStalled**: 결정 1의 relay 단축과 짝을 이루는 장애 감지 — relay가 중단되면 미발행 이벤트가 100건 초과 시 2분 내 알림

---

## 연관 ADR

- ADR-001: 좌석 잠금 SLO — HighP99Latency threshold 근거
- ADR-006: HikariCP 튜닝 — relay 빈 폴링 증가에 대한 pool 여유 근거
- ADR-007: E2E 부하 테스트 전략 — relay 단축 및 알림 기준 권고 출처
