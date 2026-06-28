/**
 * W5 E2E 플로우 테스트: 대기열 진입 → 좌석 잠금 → 결제
 * 실행: k6 run k6/full-flow.js
 *
 * 각 VU가 실제 사용자 1명의 전체 흐름을 시뮬레이션한다.
 * RPS보다 "전환율"과 "전체 플로우 P99"가 핵심 지표.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const flowDuration    = new Trend('flow_total_ms', true);
const queueDuration   = new Trend('step_queue_ms', true);
const lockDuration    = new Trend('step_lock_ms', true);
const orderDuration   = new Trend('step_order_ms', true);
const paymentDuration = new Trend('step_payment_ms', true);
const flowSuccess     = new Counter('flow_success');
const flowAborted     = new Counter('flow_aborted');
const paymentSuccess  = new Rate('payment_success_rate');

export const options = {
  scenarios: {
    full_flow: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '60s', target: 300 },
        { duration: '60s', target: 500 },  // 추가
        { duration: '30s', target: 500 },  // sustain
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    flow_total_ms:        ['p(95)<5000'],  // E2E 95th percentile < 5s
    step_lock_ms:         ['p(99)<800'],
    step_order_ms:        ['p(99)<500'],   // 주문 생성 P99 < 500ms
    step_payment_ms:      ['p(99)<1500'],
    payment_success_rate: ['rate>0.85'],   // PG 90% 성공률 반영
    http_req_failed:      ['rate<0.01'],
  },
};

const QUEUE_URL   = __ENV.QUEUE_URL   || 'http://localhost:8081';
const SEAT_URL    = __ENV.SEAT_URL    || 'http://localhost:8082';
const ORDER_URL   = __ENV.ORDER_URL   || 'http://localhost:8083';
const PAYMENT_URL = __ENV.PAYMENT_URL || 'http://localhost:8084';
const SHOW_ID     = 1;
const TOTAL_SEATS = 100;

export default function () {
  const userId   = `vu-${__VU}-${__ITER}`;
  const flowStart = Date.now();

  // ── Step 1: 대기열 진입 ──────────────────────────────────────────────
  let position;
  group('1_queue_enter', () => {
    const t = Date.now();
    const res = http.post(
      `${QUEUE_URL}/queue/enter`,
      JSON.stringify({ userId, showId: SHOW_ID }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    queueDuration.add(Date.now() - t);

    const ok = check(res, { 'queue enter 200': (r) => r.status === 200 });
    if (!ok) { flowAborted.add(1); return; }

    position = res.json('position');
  });

  // 대기열 위치에 비례한 대기 (시뮬레이션 단축: 실제는 SSE로 통보)
  const waitMs = Math.min((position || 1) * 50, 2000);
  sleep(waitMs / 1000);

  // ── Step 2: 좌석 잠금 ──────────────────────────────────────────────
  let seatId;
  group('2_seat_lock', () => {
    seatId = Math.floor(Math.random() * TOTAL_SEATS) + 1;
    const t = Date.now();
    const res = http.post(
      `${SEAT_URL}/seats/${seatId}/lock`,
      JSON.stringify({ userId, showId: SHOW_ID }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    lockDuration.add(Date.now() - t);

    const ok = check(res, { 'seat lock 200': (r) => r.status === 200 });
    if (!ok) { flowAborted.add(1); seatId = null; }
  });

  if (!seatId) return;

  // ── Step 2.5: 주문 생성 ──────────────────────────────────────────────
  let orderId;
  group('2_5_order_create', () => {
    const t = Date.now();
    const res = http.post(
      `${ORDER_URL}/orders`,
      JSON.stringify({ userId, seatId, showId: SHOW_ID }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    orderDuration.add(Date.now() - t);

    const ok = check(res, { 'order create 201': (r) => r.status === 201 });
    if (!ok) { flowAborted.add(1); orderId = null; }
    else orderId = res.json('id');
  });

  if (!orderId) return;

  // ── Step 3: 결제 ───────────────────────────────────────────────────
  group('3_payment', () => {
    const idempotencyKey = `${userId}-${seatId}-${__ITER}`;

    const t = Date.now();
    const res = http.post(
      `${PAYMENT_URL}/payments`,
      JSON.stringify({ orderId, seatId, showId: SHOW_ID, userId, idempotencyKey }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    paymentDuration.add(Date.now() - t);

    const succeeded = res.status === 200;
    check(res, { 'payment 200 or 422': (r) => r.status === 200 || r.status === 422 });
    paymentSuccess.add(succeeded ? 1 : 0);

    if (succeeded) {
      flowSuccess.add(1);
    } else {
      flowAborted.add(1);
    }
  });

  flowDuration.add(Date.now() - flowStart);
}

export function handleSummary(data) {
  return {
    'k6/results/full-flow-summary.json': JSON.stringify(data, null, 2),
  };
}
