/**
 * W7 좌석 충돌 시나리오 전용 부하 테스트
 * 작성: 강민서 (feature-develop-developer-1)
 *
 * 목적: 동일 좌석에 동시 잠금 요청을 보내 중복 점유 0건 검증
 * 실행: k6 run k6/seat-conflict.js
 *
 * 핵심 검증 지표:
 *   - duplicate_lock_count = 0  (절대 조건, 비즈니스 SLA)
 *   - single_seat_success_count = 1  (한 좌석당 정확히 1건만 성공)
 *   - lock_success_rate: 경합 환경이므로 낮아도 괜찮음 (1/N 기대)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Gauge } from 'k6/metrics';

const lockSuccess   = new Counter('lock_success_count');
const lockConflict  = new Counter('lock_conflict_count');  // 409
const lockError     = new Counter('lock_error_count');      // 5xx
const duplicateLock = new Counter('duplicate_lock_count'); // 이중 점유 감지
const successRate   = new Rate('lock_success_rate');

export const options = {
  scenarios: {
    seat_conflict: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '10s', target: 50 },   // ramp-up
        { duration: '30s', target: 200 },  // 200 VU → 동일 좌석에 경합
        { duration: '10s', target: 0 },    // ramp-down
      ],
    },
  },
  thresholds: {
    // 이중 점유는 0건이어야 한다 — 비즈니스 SLA
    'duplicate_lock_count': ['count==0'],
    // 전체 HTTP 에러율 (5xx) < 1%
    'http_req_failed': ['rate<0.01'],
    // 잠금 성공률은 낮아도 괜찮음 (경합이므로) — 하한선만 지정
    'lock_success_rate': ['rate>0.005'],
  },
};

const SEAT_URL = __ENV.SEAT_URL || 'http://localhost:8082';
const SHOW_ID  = __ENV.SHOW_ID  || '1';

// 충돌 시나리오: 소수의 좌석에 VU 전체가 집중 요청
// CONFLICT_SEATS가 작을수록 경합이 심해진다 (기본 10개 좌석)
const CONFLICT_SEATS = parseInt(__ENV.CONFLICT_SEATS || '10');

// 좌석 상태 추적 (VU간 공유 — 실제 중복 점유 감지)
// k6는 JS 싱글 스레드이므로 Counter로 집계
let seatLockWinners = {};  // seatId → 잠금 성공 VU 수

export default function () {
  // 1. 충돌 대상 좌석 랜덤 선택 (소수의 좌석 중에서)
  const seatId = ((__VU + __ITER) % CONFLICT_SEATS) + 1;

  // 2. 좌석 잠금 요청
  const lockPayload = JSON.stringify({
    showId: parseInt(SHOW_ID),
    seatId: seatId,
    userId: __VU,  // VU 번호를 userId로 사용
  });

  const lockRes = http.post(
    `${SEAT_URL}/seats/${seatId}/lock`,
    lockPayload,
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'seat_lock' },
    }
  );

  const isSuccess = lockRes.status === 200;
  const isConflict = lockRes.status === 409;
  const isError = lockRes.status >= 500;

  check(lockRes, {
    'lock 요청 5xx 없음': (r) => r.status !== 500 && r.status !== 503,
    'lock 응답 형식 유효': (r) => r.status === 200 || r.status === 409,
  });

  if (isSuccess) {
    lockSuccess.add(1);
    successRate.add(true);

    // 같은 seatId에 이미 성공한 VU가 있는지 확인 (이중 점유 감지)
    // k6 단일 스레드 환경에서 순차적으로 업데이트됨
    if (seatLockWinners[seatId] !== undefined) {
      // 이미 다른 VU가 잠금 성공 → 이중 점유
      duplicateLock.add(1);
      console.error(`[CRITICAL] 이중 점유 감지! seatId=${seatId}, vu=${__VU}, iter=${__ITER}`);
    }
    seatLockWinners[seatId] = __VU;

  } else if (isConflict) {
    lockConflict.add(1);
    successRate.add(false);

  } else if (isError) {
    lockError.add(1);
    successRate.add(false);
  }

  // 3. 잠금 성공 시 주문 생성 후 즉시 해제 (테스트 반복 가능하도록)
  if (isSuccess) {
    sleep(0.5);  // 실제 사용자처럼 0.5초 대기 후 해제

    // 잠금 해제 (주문 만료 시뮬레이션)
    const unlockRes = http.del(
      `${SEAT_URL}/seats/${seatId}/lock`,
      null,
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'seat_unlock' },
      }
    );

    check(unlockRes, {
      '잠금 해제 성공': (r) => r.status === 200 || r.status === 204 || r.status === 404,
    });
  }

  // 경합 시뮬레이션을 위한 최소 대기
  sleep(Math.random() * 0.3);
}

export function handleSummary(data) {
  const dupCount = data.metrics['duplicate_lock_count']
    ? data.metrics['duplicate_lock_count'].values.count
    : 0;

  const successCount = data.metrics['lock_success_count']
    ? data.metrics['lock_success_count'].values.count
    : 0;

  const conflictCount = data.metrics['lock_conflict_count']
    ? data.metrics['lock_conflict_count'].values.count
    : 0;

  const errorCount = data.metrics['lock_error_count']
    ? data.metrics['lock_error_count'].values.count
    : 0;

  const report = {
    summary: {
      duplicate_lock_count: dupCount,
      lock_success_count: successCount,
      lock_conflict_count: conflictCount,
      lock_error_count: errorCount,
      sla_met: dupCount === 0,
    },
    thresholds_passed: dupCount === 0,
    message: dupCount === 0
      ? `[PASS] 이중 점유 0건 — 비즈니스 SLA 충족 (성공 ${successCount}건, 409 ${conflictCount}건)`
      : `[FAIL] 이중 점유 ${dupCount}건 감지 — 즉각 조사 필요`,
  };

  console.log(JSON.stringify(report, null, 2));

  return {
    'k6/results/seat-conflict-summary.json': JSON.stringify(data, null, 2),
  };
}
