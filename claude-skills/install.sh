#!/usr/bin/env bash
# claude-skills 설치 스크립트
# skills/ 아래의 모든 스킬을 이 컴퓨터의 ~/.claude/skills/ 에 등록한다.
# 여러 번 실행해도 안전하다 (idempotent).
#
# 사용법:
#   bash install.sh            # 심볼릭 링크로 설치 (git pull 하면 자동 반영)
#   bash install.sh --copy     # 파일 복사로 설치 (저장소를 지워도 동작)
#   bash install.sh --uninstall
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$REPO_DIR/skills"
DEST_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
MODE="link"

case "${1:-}" in
  --copy) MODE="copy" ;;
  --uninstall) MODE="uninstall" ;;
  "") ;;
  *) echo "알 수 없는 옵션: $1 (사용 가능: --copy, --uninstall)" >&2; exit 1 ;;
esac

mkdir -p "$DEST_DIR"
echo "==> claude-skills $MODE (repo: $REPO_DIR -> $DEST_DIR)"

for skill_path in "$SRC_DIR"/*/; do
  [ -f "$skill_path/SKILL.md" ] || continue
  name="$(basename "$skill_path")"
  src="${skill_path%/}"
  dest="$DEST_DIR/$name"

  if [ "$MODE" = "uninstall" ]; then
    if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
      rm "$dest"; echo "  - $name: 링크 제거"
    elif [ -d "$dest" ] && diff -rq "$src" "$dest" >/dev/null 2>&1; then
      rm -rf "$dest"; echo "  - $name: 복사본 제거"
    else
      echo "  - $name: 이 저장소가 설치한 것이 아니므로 건너뜀"
    fi
    continue
  fi

  # 이미 같은 링크면 그대로 둔다
  if [ "$MODE" = "link" ] && [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    echo "  - $name: 이미 설치됨 (링크)"
    continue
  fi

  # 기존 설치가 다른 것이면 백업한다 (덮어쓰지 않음)
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ -L "$dest" ]; then
      rm "$dest"
    else
      backup="$dest.bak.$(date +%Y%m%d%H%M%S)"
      mv "$dest" "$backup"
      echo "  - $name: 기존 디렉토리 백업 -> $backup"
    fi
  fi

  if [ "$MODE" = "link" ]; then
    ln -s "$src" "$dest"
    echo "  - $name: 링크 설치 -> $dest"
  else
    cp -R "$src" "$dest"
    echo "  - $name: 복사 설치 -> $dest"
  fi
done

echo "==> 완료. 실행 중인 Claude Code 세션은 재시작해야 새 스킬이 보입니다."
