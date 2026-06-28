#!/usr/bin/env bash
# 로컬 개발 환경 시작 스크립트
# 1. OpenSearch 서버 실행 (이미 떠 있으면 재사용)
# 2. 샘플 데이터 500건 시드 (매번 재생성)
# 3. Compose Desktop 앱 실행

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JAVA_HOME="${JAVA_HOME:-$HOME/jdk/jdk-21.0.5+11}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
export DISPLAY="${DISPLAY:-:0}"

OPENSEARCH_BIN="$HOME/opensearch-local/opensearch-2.19.0/bin/opensearch"
OPENSEARCH_LOG="/tmp/opensearch.log"
APP_LOG="/tmp/opensearch-app.log"

# ── 1. OpenSearch 시작 ──────────────────────────────────────────────
if curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; then
    echo "[1/3] OpenSearch 이미 실행 중 — 재사용합니다."
else
    echo "[1/3] OpenSearch 시작 중..."
    nohup "$OPENSEARCH_BIN" > "$OPENSEARCH_LOG" 2>&1 &

    echo -n "      대기 중 "
    for i in $(seq 1 30); do
        if curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; then
            echo " 준비 완료 (${i}×2초)"
            break
        fi
        echo -n "."
        sleep 2
    done

    if ! curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; then
        echo ""
        echo "❌ OpenSearch 시작 실패. 로그: $OPENSEARCH_LOG"
        exit 1
    fi
fi

# ── 2. 샘플 데이터 시드 ─────────────────────────────────────────────
echo "[2/3] 샘플 데이터 500건 시드..."
python3 "$SCRIPT_DIR/docker/seed-data.py"

# ── 3. 앱 실행 ─────────────────────────────────────────────────────
echo "[3/3] OpenSearch Client 앱 시작..."
nohup bash -c "cd '$SCRIPT_DIR/app' && ./gradlew run" > "$APP_LOG" 2>&1 &
APP_PID=$!

echo ""
echo "✅ 앱 시작됨 (PID $APP_PID)"
echo "   로그: tail -f $APP_LOG"
echo "   종료: kill $APP_PID"
