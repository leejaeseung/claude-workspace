# ADR-001: 좌석 분산락 구현 방식

- **상태**: 결정됨
- **날짜**: 2026-05-09
- **작성자**: 박지훈 (팀 리더)
- **갈등 분류**: G1 — 강민서(Redis Lua) vs 하진우(PostgreSQL SELECT FOR UPDATE)

---

## 컨텍스트

`seat-api`에서 동일 좌석의 동시 점유를 방지하기 위한 분산락 구현 방식을 결정해야 한다.
k6 부하 테스트 환경: 로컬, 3,000 RPS 목표, 좌석 1,000개

---

## 검토한 선택지

### Option A — Redis Lua Script (강민서 제안)
```lua
if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    return 1
else
    return 0
end
```
- 장점: 원자적 실행 보장, 평균 응답 0.3ms, DB 커넥션 풀 미사용, TTL 자동 만료
- 단점: Redis 장애 시 락 관리 불가, 데이터 영속성 없음

### Option B — PostgreSQL SELECT FOR UPDATE (하진우 제안)
```sql
SELECT * FROM seats WHERE id = ? FOR UPDATE
```
- 장점: ACID 트랜잭션 내 처리, DB 단일 진실 공급원, 감사 로그 자연 생성
- 단점: HikariCP 커넥션 점유, 3,000 RPS 시 커넥션 풀 고갈 위험 (pool=10 기준)

---

## PoC 결과 (W2, 로컬 k6 500 RPS)

| 지표 | Redis Lua | SELECT FOR UPDATE |
|------|-----------|------------------|
| P50 응답시간 | 1.2ms | 8.4ms |
| P99 응답시간 | 4.1ms | 62ms |
| 중복 점유 발생 | 0건 | 0건 |
| 500 RPS 안정성 | 안정 | 커넥션 대기 발생 |
| 커넥션 풀 사용 | 0 | 최대 10 |

---

## 결정: **Option A — Redis Lua Script**

500 RPS PoC에서 P99 응답시간 4.1ms vs 62ms로 Redis Lua가 15배 빠름. 3,000 RPS 목표에서 SELECT FOR UPDATE는 커넥션 풀 고갈이 예측되어 탈락.

감사 로그는 Kafka `seat.changed` 이벤트로 대체하여 하진우가 우려한 데이터 추적성을 보완한다.

### 하진우 의견 반영 사항
- Redis 장애 대비: Redis Sentinel 또는 단순 재시도(TTL 만료 후 자동 해제)로 graceful degradation 설계 (W4에서 구현)
- 감사 로그: `SeatChangedEvent` Kafka 이벤트에 `lockedBy`, `lockedAt` 필드 추가

---

## 결과 (예상)
- 분산락 P99 4ms 이하 달성 가능
- 커넥션 풀 고갈 없음
- W5 부하테스트 1차에서 검증 예정
