# PG Mock POC Report — Circuit Breaker + Retry (Resilience4j)

**작성일**: 2026-05-30
**작성자**: 강민서 (feature-develop-developer-1)
**대상 모듈**: `payment-api`

---

## 1. 목적

`callMockPg()` 호출에 Resilience4j Circuit Breaker + Retry를 적용하여:

1. PG 장애 시 결제 서비스 전체 지연/장애 전파 방지
2. 일시적 오류에 대한 자동 재시도로 성공률 향상
3. 추후 `@CircuitBreaker` / `@Retry` 어노테이션 전환 비용 최소화

---

## 2. 변경 사항 요약

### 2-1. `payment-api/build.gradle.kts`

```kotlin
implementation("io.github.resilience4j:resilience4j-spring-boot3:2.2.0")
implementation("org.springframework.boot:spring-boot-starter-aop")
implementation("org.springframework.boot:spring-boot-starter-actuator")
```

- `resilience4j-spring-boot3` — Spring Boot 3.x 전용 자동 설정 포함
- `spring-boot-starter-aop` — 이후 `@CircuitBreaker` / `@Retry` 어노테이션 방식 전환 시 추가 의존성 없이 사용 가능
- `spring-boot-starter-actuator` — CB 상태 및 메트릭 노출 (`/actuator/circuitbreakers`, `/actuator/health`)

### 2-2. `core-domain/.../DomainError.kt`

```kotlin
data class PgUnavailable(val reason: String) : DomainError("PG is unavailable: $reason")
```

CB OPEN 상태 또는 재시도 소진 시 `Either.Left`로 반환할 새 에러 타입 추가.

### 2-3. `PaymentService.kt`

- `CircuitBreakerRegistry` / `RetryRegistry` Bean을 생성자 주입
- `callMockPgWithResilience()` 내부 메서드에서 `callMockPg()`를 CB → Retry로 데코레이트
- CB OPEN → `CallNotPermittedException` catch → `DomainError.PgUnavailable` 반환
- 재시도 소진 시 `Exception` catch → 동일하게 `DomainError.PgUnavailable` 반환

**어노테이션 전환 경로**: `callMockPgWithResilience()` 삭제, `callMockPg()`에 아래 추가하면 끝:

```kotlin
@CircuitBreaker(name = "mock-pg", fallbackMethod = "callMockPgFallback")
@Retry(name = "mock-pg")
private fun callMockPg(orderId: Long, idempotencyKey: String): Boolean = ...
```

`application.yml` 설정은 변경 불필요.

### 2-4. `application.yml` — Resilience4j 설정

| 항목 | 설정값 | 근거 |
|------|--------|------|
| CB sliding-window-size | 10 | 소량 트래픽 POC 환경 기준, 실제 운영 시 100으로 확대 권장 |
| CB failure-rate-threshold | 50% | 10회 중 5회 실패 시 OPEN — 50%는 표준 시작점 |
| CB wait-duration-in-open-state | 10,000ms | PG 복구 시간 고려, 10초 후 HALF_OPEN 시도 |
| CB permitted-calls-in-half-open | 3 | HALF_OPEN 탐색 트래픽 최소화 |
| Retry max-attempts | 3 | 최초 1회 + 재시도 2회 |
| Retry wait-duration | 500ms | 고정 간격 (Mock PG에 적합, 실제 PG는 지수 백오프 권장) |
| Retry ignore | `CallNotPermittedException` | CB OPEN 중 재시도 금지 — 의미 없는 시도 차단 |

---

## 3. Circuit Breaker 상태 전이

```
           실패율 >= 50%
CLOSED ─────────────────► OPEN
  ▲                         │ wait 10s
  │                         ▼
  │ 3회 프로브 성공    HALF_OPEN
  └───────────────────────────
```

- **CLOSED**: 정상 운영. 실패율 50% 미만 유지.
- **OPEN**: PG 장애 감지. `callMockPgWithResilience()` 즉시 `CallNotPermittedException` 발생 → `DomainError.PgUnavailable` 반환. PG 재호출 없음.
- **HALF_OPEN**: 10초 후 3회 탐색 호출. 성공 시 CLOSED 복귀, 실패 시 OPEN 재진입.

---

## 4. Actuator 모니터링 엔드포인트

CB 상태 및 메트릭은 다음 엔드포인트로 확인한다.

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /actuator/health` | CB 상태 포함 전체 헬스 (`mock-pg`: UP/CIRCUIT_OPEN) |
| `GET /actuator/circuitbreakers` | CB 상세 상태 (state, failureRate, callsCount 등) |
| `GET /actuator/metrics/resilience4j.circuitbreaker.calls` | Prometheus 호환 메트릭 |
| `GET /actuator/metrics/resilience4j.retry.calls` | Retry 성공/실패/재시도 횟수 |

Prometheus scrape는 기존 `/actuator/prometheus` 엔드포인트에 자동 포함된다.

---

## 5. 시나리오별 동작

| 시나리오 | CB 상태 | Retry 동작 | 최종 결과 |
|---------|---------|-----------|---------|
| PG 정상 응답 | CLOSED | 1회 성공, 재시도 없음 | `Payment(COMPLETED)` |
| PG 일시 오류 (1~2회) | CLOSED | 최대 3회 재시도 후 성공 | `Payment(COMPLETED)` |
| PG 연속 실패 (실패율 ≥ 50%) | CLOSED → OPEN | 재시도 후 OPEN 전환 | `DomainError.PgUnavailable` |
| CB OPEN 상태 | OPEN | 재시도 없음 (즉시 차단) | `DomainError.PgUnavailable` |
| CB HALF_OPEN 탐색 성공 | HALF_OPEN → CLOSED | 1회 성공 | `Payment(COMPLETED)` |
| Mock PG 90% 실패 시뮬레이션 (`orderId % 10 == 0`) | 점진적 OPEN | — | `DomainError.PgUnavailable` |

---

## 6. 미결 사항 (W5+ 이슈)

- [ ] 실제 PG 연동 시 `wait-duration` → 지수 백오프 (`exponential-backoff-multiplier`) 적용
- [ ] CB `sliding-window-size` 운영 트래픽 기준 재조정 (권장: 100)
- [ ] `@CircuitBreaker` / `@Retry` 어노테이션 방식으로 전환 (fallbackMethod 포함)
- [x] `PaymentService` 단위 테스트 — Kotest + Mockito-kotlin, CB OPEN / idempotency / PG 실패 5건 작성 완료 (2026-06-03)
- [ ] Grafana 대시보드에 `resilience4j.circuitbreaker.state` 패널 추가

---

## 7. 참고

- Resilience4j 공식 문서: https://resilience4j.readme.io/docs/circuitbreaker
- Spring Boot 3.x 통합 가이드: https://resilience4j.readme.io/docs/getting-started-3
- 버전: `resilience4j-spring-boot3:2.2.0` (Spring Boot 3.4.1 호환 확인)
