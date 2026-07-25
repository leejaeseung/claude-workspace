#!/usr/bin/env bash
# claude-code-modes 설치 스크립트
# claude-digger / claude-dev / claude-pm 세 페르소나를 이 컴퓨터의 Claude Code에 등록한다.
# 여러 번 실행해도 안전하다 (idempotent).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
MODES_DIR="$CLAUDE_DIR/claude-modes"
BIN_DIR="$HOME/.local/bin"

echo "==> claude-code-modes 설치 시작 (repo: $REPO_DIR)"

# 1) 디렉토리 준비
mkdir -p "$MODES_DIR/personas" "$BIN_DIR"
mkdir -p "$CLAUDE_DIR/digging/raw" "$CLAUDE_DIR/digging/notes"
mkdir -p "$CLAUDE_DIR/develop/retrospectives"
mkdir -p "$CLAUDE_DIR/pm-projects"

# 2) persona 파일 + 훅 스크립트 설치
cp "$REPO_DIR/personas/CLAUDE_DIGGER.md" "$MODES_DIR/personas/CLAUDE_DIGGER.md"
cp "$REPO_DIR/personas/CLAUDE_DEV.md" "$MODES_DIR/personas/CLAUDE_DEV.md"
cp "$REPO_DIR/personas/CLAUDE_PM.md" "$MODES_DIR/personas/CLAUDE_PM.md"
cp "$REPO_DIR/hooks/session-start-inject.sh" "$MODES_DIR/session-start-inject.sh"
chmod +x "$MODES_DIR/session-start-inject.sh"
echo "  - persona 3종 + 훅 스크립트 -> $MODES_DIR"

# 3) 모드 진입 커맨드 설치
for mode in digger dev pm; do
  cp "$REPO_DIR/bin/claude-$mode" "$BIN_DIR/claude-$mode"
  chmod +x "$BIN_DIR/claude-$mode"
done
echo "  - claude-digger / claude-dev / claude-pm -> $BIN_DIR"

# 4) 초기 인덱스 파일 (이미 있으면 건드리지 않음)
if [ ! -f "$CLAUDE_DIR/digging/index.md" ]; then
  cat > "$CLAUDE_DIR/digging/index.md" <<'EOF'
# Digging Index

| 주제 | 노트 | 태그 | 최초 작성 | 최근 갱신 |
|------|------|------|-----------|-----------|
EOF
fi
if [ ! -f "$CLAUDE_DIR/digging/log.md" ]; then
  cat > "$CLAUDE_DIR/digging/log.md" <<'EOF'
# Digging Log

- (여기에 조사 처리 이력을 날짜순으로 기록)
EOF
fi
if [ ! -f "$CLAUDE_DIR/develop/index.md" ]; then
  cat > "$CLAUDE_DIR/develop/index.md" <<'EOF'
# Develop Retrospective Index

| 날짜 | 작업 | 프로젝트 | 핵심 교훈 | 링크 |
|------|------|----------|-----------|------|
EOF
fi
if [ ! -f "$CLAUDE_DIR/pm-projects/index.md" ]; then
  cat > "$CLAUDE_DIR/pm-projects/index.md" <<'EOF'
# PM Projects Index

| 프로젝트 | 경로 | 개요 | 최근 갱신 |
|----------|------|------|-----------|
EOF
fi
echo "  - 인덱스 파일 준비 완료 (digging/develop/pm-projects)"

# 5) ~/.claude/settings.json 에 SessionStart 훅 병합 (기존 설정 보존)
node "$REPO_DIR/scripts/merge-settings.js" "$CLAUDE_DIR/settings.json" "$MODES_DIR/session-start-inject.sh"

# 6) PATH 확인
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "⚠️  $BIN_DIR 이(가) 현재 PATH에 없습니다. 쉘 설정 파일(예: ~/.bashrc)에 아래 줄을 추가하세요:"
  echo '  export PATH="$HOME/.local/bin:$PATH"'
fi

echo ""
echo "==> 설치 완료."
echo "    claude-digger / claude-dev / claude-pm 명령으로 각 모드에 진입할 수 있습니다."
