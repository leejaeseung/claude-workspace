#!/usr/bin/env bash
# SessionStart 훅: CLAUDE_MODE 환경변수(digger/dev/pm)에 따라
# 해당 persona 마크다운을 additionalContext로 stdout에 JSON 출력한다.
#
# claude-digger / claude-dev / claude-pm 래퍼 스크립트가 CLAUDE_MODE를 export하고
# claude를 실행하면, 이 스크립트가 SessionStart 훅으로 호출되어 시스템 프롬프트에
# 해당 persona 내용을 주입한다. CLAUDE_MODE가 없으면(평범한 `claude` 실행) 아무것도
# 하지 않는다.
set -euo pipefail

# 훅 이벤트 JSON(session_id 등)은 사용하지 않으므로 버린다.
cat >/dev/null

BASE_DIR="$HOME/.claude/claude-modes"

case "${CLAUDE_MODE:-}" in
  digger) FILE="$BASE_DIR/personas/CLAUDE_DIGGER.md" ;;
  dev)    FILE="$BASE_DIR/personas/CLAUDE_DEV.md" ;;
  pm)     FILE="$BASE_DIR/personas/CLAUDE_PM.md" ;;
  *)      exit 0 ;;
esac

[ -f "$FILE" ] || exit 0

node -e '
const fs = require("fs");
const content = fs.readFileSync(process.argv[1], "utf8");
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: content
  }
}));
' "$FILE"
