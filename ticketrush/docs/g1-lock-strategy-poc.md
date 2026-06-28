# G1 Lock Strategy PoC — Redis Lua vs PostgreSQL SELECT FOR UPDATE

- **작성일**: 2026-05-30
- **작성자**: 하진우 (feature-develop 시니어, SELECT FOR UPDATE 주장)
- **검토자**: 강민서 (feature-develop 미드레벨, Redis Lua 주장)
- **관련 ADR**: [ADR-001 좌석 분산락 구현 방식](./adr/ADR-001-seat-lock-strategy.md)

---

## 배경

ADR-001은 500 RPS PoC 결과를 근거로 Redis Lua를 채택했다. 그러나 해당 PoC는 DB 락 경로가
실제로 실행 가능한 상태(`infra-jpa` 의존성 누락, 클래스 레벨 `@Version` 버그)가 아니었다.
이번 PoC는 두 경로를 모두 실행 가능하게 만든 뒤 동일 환경에서 재비교하여 의사결정 근거를
보강한다.

---

## 참여자별 입장

### 강민서 — Redis Lua Script 주장

> "Redis Lua는 단일 명령 원자성 + 메모리 속도 덕분에 응답 지연이 낮고,
> DB 커넥션 풀 소진 위험이 없다. ADR-001의 P99 4.1ms는 재현 가능하며
> 3,000 RPS 목표를 안전하게 달성할 수 있다."

- 근거: `EXISTS + SET EX` Lua 원자 실행, TTL 자동 만료, DB 부하 분리
- 우려사항: Redis 장애 시 락 복구 불가 → Sentinel 또는 Redlock 보완 필요

### 하진우 — PostgreSQL SELECT FOR UPDATE 주장

> "Redis는 네트워크 파티션이나 OOM 발생 시 락 정보를 잃는다.
> SELECT FOR UPDATE는 ACID 트랜잭션 내에서 DB 단일 진실 공급원을 유지하고,
> `version` 컬럼과 함께 감사 추적이 자연스럽게 생성된다.
> 커넥션 풀 고갈 문제는 pool-size 튜닝과 락 구간 최소화로 충분히 해결 가능하다."

- 근거: ACID 보장, 장애 시 자동 롤백(커넥션 종료 = 락 해제), 추가 인프라 불필요
- 우려사항: HikariCP pool-size=10 기준 고 동시성에서 큐잉 발생 → pool 확대 필요

---

## 구현 변경 사항 (이번 PoC에서 완료)

| 항목 | 파일 | 변경 내용 |
|------|------|-----------|
| 버그 수정 | `SeatEntity.kt` | 클래스 레벨 `@Version` 제거 (필드 레벨만 유지) |
| 의존성 추가 | `seat-api/build.gradle.kts` | `infra-jpa` 모듈 + `kotlin("plugin.jpa")` 추가 |
| 락 쿼리 | `SeatRepository.kt` | `findByIdForUpdate()` — `@Lock(PESSIMISTIC_WRITE)` 추가 |
| 서비스 메서드 | `SeatLockService.kt` | `acquireWithDbLock()` 추가 |
| 엔드포인트 | `SeatController.kt` | `POST /seats/{seatId}/lock-db` 추가 |
| Kafka 메트릭 | `KafkaConsumerConfig.kt` | `MicrometerConsumerListener` 등록 |
| Kafka 설정 | `seat-api/application.yml` | consumer 속성 명시 (auto-commit 비활성, max-poll 등) |

### WebFlux + 블로킹 JPA 처리 방식

`acquireWithDbLock()`은 WebFlux 이벤트 루프를 블로킹하지 않도록
`Mono.fromCallable { ... }.subscribeOn(Schedulers.boundedElastic())` 패턴을 사용한다.

`@Transactional`을 Mono 반환 메서드에 사용하면 구독 전에 트랜잭션이 커밋되어
`SELECT FOR UPDATE` 락이 실제로 보호되지 않는다. 이를 방지하기 위해
`TransactionTemplate.execute { }` 블록 내에서 락 획득과 상태 변경을 모두 수행한다.

```kotlin
fun acquireWithDbLock(seatId: Long, userId: String): Mono<Either<DomainError, SeatLock>> =
    Mono.fromCallable {
        transactionTemplate.execute {
            val seat = seatRepository.findByIdForUpdate(seatId)  // SELECT ... FOR UPDATE
                ?: return@execute DomainError.SeatNotFound(seatId).left()
            if (seat.status != SeatEntity.SeatStatus.AVAILABLE)
                return@execute DomainError.SeatAlreadyLocked(seatId).left()
            seat.status = SeatEntity.SeatStatus.LOCKED
            seatRepository.save(seat)
            SeatLock(...).right()
        } ?: DomainError.SeatNotFound(seatId).left()
    }.subscribeOn(Schedulers.boundedElastic())
```

---

## k6 비교 테스트 계획

### 테스트 대상 엔드포인트

| 경로 | 락 방식 |
|------|---------|
| `POST /seats/{seatId}/lock` | Redis Lua (기존) |
| `POST /seats/{seatId}/lock-db` | PostgreSQL SELECT FOR UPDATE (신규) |

### 시나리오

```javascript
// k6/seat-rush.js 에 lock-db 시나리오 추가 예정
export const options = {
  scenarios: {
    redis_lua: {
      executor: 'constant-arrival-rate',
      rate: 500,
      duration: '60s',
      preAllocatedVUs: 100,
      exec: 'lockWithRedis',
    },
    db_lock: {
      executor: 'constant-arrival-rate',
      rate: 500,
      duration: '60s',
      preAllocatedVUs: 100,
      exec: 'lockWithDb',
    },
  },
};
```

### 측정 지표

- P50 / P95 / P99 응답 시간
- 중복 점유 발생 건수 (0이어야 함)
- HikariCP 활성 커넥션 수 (`hikaricp_connections_active`)
- Kafka consumer lag (`kafka_consumer_fetch_manager_records_lag`)
- JVM GC pause (ZGC 기준)

### 예상 결과 (하진우 예측)

| 지표 | Redis Lua | SELECT FOR UPDATE |
|------|-----------|------------------|
| P50 응답시간 | ~1ms | ~5-10ms |
| P99 응답시간 | ~5ms | ~30-80ms |
| 중복 점유 | 0건 | 0건 |
| 커넥션 풀 사용률 | 0% | 60-100% (pool=10 기준) |
| Redis 장애 시 | 락 소실 | 자동 롤백 보장 |

> **하진우 주장**: pool-size를 50으로 확대하면 SELECT FOR UPDATE의 P99는
> 20ms 이내로 수렴 가능하다. 3,000 RPS에서도 `lock`구간 자체가 짧아
> 커넥션 반납이 빠르므로 고갈 위험은 과대평가되어 있다.

> **강민서 반론**: Redis 응답의 10배 이상 차이는 pool 튜닝으로 좁힐 수 없다.
> 네트워크 RTT + 디스크 I/O 구조적 차이가 있으며, Redis Sentinel로 HA는
> 충분히 보완된다.

---

## 기존 ADR-001과의 관계

이 문서는 ADR-001을 **대체하지 않는다**. ADR-001의 결정(Redis Lua 채택)은 유지되며,
이번 PoC는 다음 목적을 위해 작성된다:

1. DB 락 경로를 실행 가능하게 만들어 ADR-001의 비교 수치가 유효함을 재확인
2. 3,000 RPS 목표 달성 전 위험 요소를 정량화
3. Redis 장애 대비 전략(W4 예정)의 기준선 수립

---

## 결론 및 다음 단계

- [ ] k6 `seat-rush.js`에 `lockWithDb` 함수 추가
- [ ] HikariCP pool-size 10 / 20 / 50 파라미터 변경 후 재측정
- [ ] 결과를 ADR-001에 부록으로 추가
- [ ] Redis Sentinel 설정 검토 (W4)
