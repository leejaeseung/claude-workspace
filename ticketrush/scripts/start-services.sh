#!/usr/bin/env bash
# W5 JVM 튜닝: G1GC → ZGC 전환 + GC 로그
# 사용법: ./scripts/start-services.sh [service-name|all]
#
# ZGC 선택 근거:
#  - G1GC: STW pause 최대 ~200ms 발생 (콘서트 오픈 피크 시 P99 급등)
#  - ZGC:  STW pause < 1ms (heap 크기와 무관) → P99 < 800ms 목표 달성에 유리
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

# ── 공통 JVM 옵션 ────────────────────────────────────────────────────────
COMMON_JVM="\
  -XX:+UseZGC \
  -XX:ZCollectionInterval=5 \
  -XX:ZUncommitDelay=300 \
  -XX:+ZProactive \
  -Xlog:gc*:file=$LOG_DIR/gc-%p.log:time,uptime,pid:filecount=5,filesize=20m \
  -Dspring.profiles.active=local"

# WebFlux 서비스: 낮은 힙 + 극저지연
WEBFLUX_JVM="$COMMON_JVM -Xms256m -Xmx768m"

# MVC 서비스: 더 큰 힙 (JPA + 스레드풀)
MVC_JVM="$COMMON_JVM -Xms512m -Xmx1536m"

# ── 서비스별 실행 함수 ───────────────────────────────────────────────────
start_queue_api() {
  echo "▶ queue-api (port 8081, WebFlux, ZGC)"
  JAVA_TOOL_OPTIONS="$WEBFLUX_JVM" \
    nohup java -jar "$PROJECT_ROOT/queue-api/build/libs/queue-api.jar" \
    > "$LOG_DIR/queue-api.log" 2>&1 &
  echo "  PID=$!"
}

start_seat_api() {
  echo "▶ seat-api (port 8082, WebFlux, ZGC)"
  JAVA_TOOL_OPTIONS="$WEBFLUX_JVM" \
    nohup java -jar "$PROJECT_ROOT/seat-api/build/libs/seat-api.jar" \
    > "$LOG_DIR/seat-api.log" 2>&1 &
  echo "  PID=$!"
}

start_order_api() {
  echo "▶ order-api (port 8083, MVC, ZGC)"
  JAVA_TOOL_OPTIONS="$MVC_JVM" \
    nohup java -jar "$PROJECT_ROOT/order-api/build/libs/order-api.jar" \
    > "$LOG_DIR/order-api.log" 2>&1 &
  echo "  PID=$!"
}

start_payment_api() {
  echo "▶ payment-api (port 8084, MVC, ZGC)"
  JAVA_TOOL_OPTIONS="$MVC_JVM" \
    nohup java -jar "$PROJECT_ROOT/payment-api/build/libs/payment-api.jar" \
    > "$LOG_DIR/payment-api.log" 2>&1 &
  echo "  PID=$!"
}

start_notification_api() {
  echo "▶ notification-api (port 8085, WebFlux, ZGC)"
  JAVA_TOOL_OPTIONS="$WEBFLUX_JVM" \
    nohup java -jar "$PROJECT_ROOT/notification-api/build/libs/notification-api.jar" \
    > "$LOG_DIR/notification-api.log" 2>&1 &
  echo "  PID=$!"
}

# ── 실행 ─────────────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
  queue-api)       start_queue_api ;;
  seat-api)        start_seat_api ;;
  order-api)       start_order_api ;;
  payment-api)     start_payment_api ;;
  notification-api) start_notification_api ;;
  all)
    start_queue_api
    start_seat_api
    start_order_api
    start_payment_api
    start_notification_api
    echo ""
    echo "모든 서비스 시작 완료. 로그: $LOG_DIR/"
    ;;
  *)
    echo "사용법: $0 [queue-api|seat-api|order-api|payment-api|notification-api|all]"
    exit 1
    ;;
esac
