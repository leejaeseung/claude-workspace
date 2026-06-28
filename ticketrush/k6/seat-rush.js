/**
 * W5 부하 테스트: 좌석 잠금 3,000 RPS 목표
 * 실행: k6 run --env BASE_URL=http://localhost:8082 k6/seat-rush.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const lockSuccess   = new Counter('seat_lock_success');
const lockConflict  = new Counter('seat_lock_conflict');
const lockError     = new Counter('seat_lock_error');
const lockDuration  = new Trend('seat_lock_p99_ms', true);
const successRate   = new Rate('seat_lock_success_rate');

export const options = {
  scenarios: {
    // constant-arrival-rate 모드: VU 수가 아닌 실제 RPS 기준으로 부하 제어
    seat_rush: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 1200,
      stages: [
        { duration: '30s', target: 1000 },  // ramp-up
        { duration: '60s', target: 3000 },  // 목표 RPS
        { duration: '30s', target: 3000 },  // sustain
        { duration: '10s', target: 0 },     // ramp-down
      ],
    },
  },
  thresholds: {
    http_req_duration:       ['p(99)<800'],   // P99 < 800ms
    http_req_failed:         ['rate<0.005'],  // 에러율 < 0.5%
    seat_lock_p99_ms:        ['p(99)<800'],
    seat_lock_success_rate:  ['rate>0.3'],    // 경합 환경: 30% 이상 성공
  },
};

const BASE_URL    = __ENV.BASE_URL || 'http://localhost:8082';
const TOTAL_SEATS = 100;   // 좌석 수를 적게 → 경합 극대화
const SHOW_ID     = 1;

export default function () {
  // 핫 좌석 집중: 상위 10개 좌석에 70% 트래픽 → 경합 시나리오
  const isHotSeat  = Math.random() < 0.7;
  const seatId     = isHotSeat
    ? Math.floor(Math.random() * 10) + 1
    : Math.floor(Math.random() * TOTAL_SEATS) + 1;
  const userId     = `load-user-${__VU}`;

  const start  = Date.now();
  const res    = http.post(
    `${BASE_URL}/seats/${seatId}/lock`,
    JSON.stringify({ userId, showId: SHOW_ID }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  lockDuration.add(Date.now() - start);

  const ok = check(res, {
    'status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 200)      { lockSuccess.add(1);  successRate.add(1); }
  else if (res.status === 409) { lockConflict.add(1); successRate.add(0); }
  else                         { lockError.add(1);    successRate.add(0); }
}

export function handleSummary(data) {
  return {
    'k6/results/seat-rush-summary.json': JSON.stringify(data, null, 2),
  };
}
