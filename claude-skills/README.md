# claude-skills

어느 컴퓨터에서든 같은 Claude Code 스킬을 쓰기 위한 개인 스킬 모음입니다.
`skills/` 아래의 각 디렉토리가 하나의 스킬이며, `install.sh`가 이를 `~/.claude/skills/`에 등록합니다 (사용자 레벨 → 모든 프로젝트에서 사용 가능).

| 스킬 | 호출 | 설명 |
|------|------|------|
| [pre-pr-review](skills/pre-pr-review/SKILL.md) | `/pre-pr-review [base] [--quick\|--deep] [--focus <영역>] [--fix]` | PR 전 심층 코드리뷰. 분야별 서브에이전트 병렬 리뷰 → 반박 에이전트 검증 → 심각도별 리포트와 머지 판정 |

이 문서는 사람과 **Claude Code 둘 다** 읽습니다. 새 컴퓨터에서 Claude Code에게 "claude-skills/README.md를 읽고 설치해줘"라고 요청하면 아래 절차를 따릅니다.

---

## 설치

```bash
git clone https://github.com/leejaeseung/claude-workspace.git
cd claude-workspace/claude-skills
bash install.sh            # 기본: 심볼릭 링크 (git pull 시 자동 반영)
# bash install.sh --copy   # 복사 설치 (Windows 등 링크가 불편한 환경)
```

- 여러 번 실행해도 안전합니다.
- 같은 이름의 스킬이 이미 `~/.claude/skills/`에 디렉토리로 있으면 `<이름>.bak.<시각>`으로 백업한 뒤 설치합니다.
- `CLAUDE_CONFIG_DIR` 환경변수를 쓰고 있다면 그 아래 `skills/`에 설치됩니다.
- 설치 후 **Claude Code 세션을 재시작**해야 스킬 목록에 나타납니다.

### 확인

```bash
ls -l ~/.claude/skills/
```
Claude Code에서 `/pre-pr-review`가 자동완성되면 성공입니다.

## 업데이트

- 링크 설치: `git pull`만 하면 됩니다.
- 복사 설치: `git pull` 후 `bash install.sh --copy`를 다시 실행합니다.

## 제거

```bash
bash install.sh --uninstall   # 이 저장소가 설치한 스킬만 제거
```

## 새 스킬 추가

1. `skills/<스킬이름>/SKILL.md`를 만듭니다 (frontmatter의 `name`은 디렉토리 이름과 동일하게).
2. 위 표에 한 줄 추가합니다.
3. 각 컴퓨터에서 `bash install.sh`를 다시 실행합니다 (링크 설치는 새 스킬만 링크하면 되므로 한 번 더 실행 필요).
