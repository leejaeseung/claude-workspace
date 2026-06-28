/**
 * G1 갈등 재검증: Redis Lua vs PostgreSQL SELECT FOR UPDATE 비교
 * 1,000 RPS 핫 좌석 집중 패턴 — ADR-001 결정을 데이터로 재확인 (ADR-005)
 *
 * 실행:
 *   k6 run \
 *     --env BASE_URL=http://localhost:8082 \
 *     k6/g1-lock-comparison.js
 *
 * 참고:
 *   - /seats/{seatId}/lock     → Redis Lua 구현 (강민서 제안, ADR-001 채택)
 *   - /seats/{seatId}/lock-db  → SELECT FOR UPDATE 구현 (하진우 제안, 미구현)
 *     ※ lock-db 엔드포인트는 현재 seat-api에 없음. 구현 전까지 DB 시나리오는
 *       예비 상태로 포함. 구현 후 BASE_URL 동일 서버에서 활성화.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ── Redis Lua 메트릭 ────────────────────────────────────────────────────────
const redisSuccess  = new Counter('redis_lock_success');
const redisConflict = new Counter('redis_lock_conflict');
const redisError    = new Counter('redis_lock_error');
const redisDuration = new Trend('redis_lock_p99_ms', true);
const redisRate     = new Rate('redis_lock_success_rate');

// ── SELECT FOR UPDATE 메트릭 ─────────────────────────────────────────────────
const dbSuccess  = new Counter('db_lock_success');
const dbConflict = new Counter('db_lock_conflict');
const dbError    = new Counter('db_lock_error');
const dbDuration = new Trend('db_lock_p99_ms', true);
const dbRate     = new Rate('db_lock_success_rate');

// ── 시나리오 설정 ─────────────────────────────────────────────────────────────
// 두 시나리오를 병렬로 실행하여 메트릭이 자연스럽게 분리되도록 구성
export const options = {
  scenarios: {
    // 강민서 제안: Redis Lua Script
    redis_lua: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '90s',
      preAllocatedVUs: 150,
      maxVUs: 600,
      exec: 'redisLock',
    },
    // 하진우 제안: PostgreSQL SELECT FOR UPDATE
    db_for_update: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '90s',
      preAllocatedVUs: 150,
      maxVUs: 600,
      exec: 'dbLock',
      startTime: '0s',
    },
  },
  thresholds: {
    // 측정 목적: 엄격한 임계값보다 비교 데이터 수집이 우선
    redis_lock_p99_ms:        ['p(99)<800'],
    db_lock_p99_ms:           ['p(99)<800'],
    redis_lock_success_rate:  ['rate>0.1'],  // 경합 환경 — 측정을 위한 최소 기준
    http_req_failed:          ['rate<0.05'],
  },
};

const BASE_URL    = __ENV.BASE_URL || 'http://localhost:8082';
const TOTAL_SEATS = 100;  // 좌석 수를 적게 → 경합 극대화
const SHOW_ID     = 1;

/**
 * 핫 좌석 집중 패턴: 상위 10개 좌석에 70% 트래픽
 * ADR-001 PoC와 동일한 경합 시나리오 재현
 */
function hotSeatId() {
  const isHotSeat = Math.random() < 0.7;
  return isHotSeat
    ? Math.floor(Math.random() * 10) + 1
    : Math.floor(Math.random() * TOTAL_SEATS) + 1;
}

// ── Redis Lua 시나리오 (/seats/{seatId}/lock) ─────────────────────────────────
export function redisLock() {
  const seatId = hotSeatId();
  const userId = `redis-vu-${__VU}`;

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/seats/${seatId}/lock`,
    JSON.stringify({ userId, showId: SHOW_ID }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  redisDuration.add(Date.now() - start);

  check(res, {
    'redis: status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 200)      { redisSuccess.add(1);  redisRate.add(1); }
  else if (res.status === 409) { redisConflict.add(1); redisRate.add(0); }
  else                         { redisError.add(1);    redisRate.add(0); }
}

// ── SELECT FOR UPDATE 시나리오 (/seats/{seatId}/lock-db) ──────────────────────
// ※ lock-db 엔드포인트 미구현 시 502/404 가 기록됨 — 실제 비교는 구현 후 실행
export function dbLock() {
  const seatId = hotSeatId();
  const userId = `db-vu-${__VU}`;

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/seats/${seatId}/lock-db`,
    JSON.stringify({ userId, showId: SHOW_ID }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  dbDuration.add(Date.now() - start);

  check(res, {
    'db: status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 200)      { dbSuccess.add(1);  dbRate.add(1); }
  else if (res.status === 409) { dbConflict.add(1); dbRate.add(0); }
  else                         { dbError.add(1);    dbRate.add(0); }
}

export function handleSummary(data) {
  return {
    'k6/results/g1-lock-comparison-summary.json': JSON.stringify(data, null, 2),
  };
}
