#!/usr/bin/env bash
# TicketRush 단일 서비스 시작 스크립트 (ADR-004 ZGC 설정 적용)
# 사용법: ./scripts/start-service.sh <service-name>
# 예시:   ./scripts/start-service.sh seat-api
#
# 지원 서비스: seat-api, queue-api, notification-api, order-api, payment-api
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
ENV_FILE="$SCRIPT_DIR/jvm-options.env"

# ── 인자 검증 ─────────────────────────────────────────────────────────────
if [ $# -ne 1 ]; then
  echo "사용법: $0 <service-name>"
  echo "지원 서비스: seat-api, queue-api, notification-api, order-api, payment-api"
  exit 1
fi

SERVICE="$1"

# ── 환경 파일 소싱 ────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "오류: JVM 환경 파일을 찾을 수 없습니다: $ENV_FILE"
  exit 1
fi

# shellcheck source=scripts/jvm-options.env
source "$ENV_FILE"

# ── 서비스별 JAVA_OPTS 및 JAR 경로 설정 ──────────────────────────────────
case "$SERVICE" in
  seat-api)
    JAVA_OPTS="${SEAT_API_JAVA_OPTS}"
    PORT=8082
    STACK="WebFlux"
    ;;
  queue-api)
    JAVA_OPTS="${QUEUE_API_JAVA_OPTS}"
    PORT=8081
    STACK="WebFlux"
    ;;
  notification-api)
    JAVA_OPTS="${NOTIFICATION_API_JAVA_OPTS}"
    PORT=8085
    STACK="WebFlux"
    ;;
  order-api)
    JAVA_OPTS="${ORDER_API_JAVA_OPTS}"
    PORT=8083
    STACK="MVC"
    ;;
  payment-api)
    JAVA_OPTS="${PAYMENT_API_JAVA_OPTS}"
    PORT=8084
    STACK="MVC"
    ;;
  *)
    echo "오류: 지원하지 않는 서비스입니다: $SERVICE"
    echo "지원 서비스: seat-api, queue-api, notification-api, order-api, payment-api"
    exit 1
    ;;
esac

JAR="$PROJECT_ROOT/$SERVICE/build/libs/$SERVICE.jar"

# ── JAR 존재 확인 ─────────────────────────────────────────────────────────
if [ ! -f "$JAR" ]; then
  echo "오류: JAR 파일을 찾을 수 없습니다: $JAR"
  echo "먼저 빌드를 실행하세요: ./gradlew :$SERVICE:bootJar"
  exit 1
fi

# ── 서비스 시작 ───────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

echo "Starting $SERVICE (port=$PORT, stack=$STACK, ZGC)"
echo "  JAR: $JAR"
echo "  LOG: $LOG_DIR/$SERVICE.log"
echo "  JAVA_OPTS: $JAVA_OPTS"

# GC 로그를 서비스 로그와 분리하여 저장
GC_LOG_OPTS="-Xlog:gc*:file=$LOG_DIR/gc-$SERVICE.log:time,uptime,pid:filecount=5,filesize=20m"

# shellcheck disable=SC2086
nohup java $JAVA_OPTS $GC_LOG_OPTS \
  -Dspring.profiles.active=local \
  -jar "$JAR" \
  > "$LOG_DIR/$SERVICE.log" 2>&1 &

echo "  PID=$!"
echo "$SERVICE started."
