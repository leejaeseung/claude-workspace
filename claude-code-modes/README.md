# claude-code-modes

Claude Code에 **3가지 전문 페르소나**를 심어서, 명령어 하나로 원하는 모드로 세션을 시작할 수 있게 하는 설정 프로젝트입니다.

| 명령어 | 페르소나 | 역할 | 데이터 디렉토리 |
|--------|----------|------|------------------|
| `claude-digger` | [personas/CLAUDE_DIGGER.md](personas/CLAUDE_DIGGER.md) | 정보 조사 및 지식 관리, 전문적 조언 | `~/.claude/digging/` |
| `claude-dev` | [personas/CLAUDE_DEV.md](personas/CLAUDE_DEV.md) | 플래닝→작성→검증→회고 루프를 따르는 개발 전문가 | `~/.claude/develop/` |
| `claude-pm` | [personas/CLAUDE_PM.md](personas/CLAUDE_PM.md) | 여러 프로젝트의 정책/아키텍처 문서 관리 | `~/.claude/pm-projects/` |

이 문서는 사람과 **Claude Code 둘 다** 읽습니다. 새 컴퓨터에서 이 저장소를 clone한 뒤 Claude Code에게 "이 README를 읽고 설치를 진행해줘"라고 요청하면, 아래 "Claude Code용 설치 절차"를 그대로 따라 이 컴퓨터에 3개 모드를 설치합니다.

---

## Claude Code용 설치 절차

다른 컴퓨터에서 이 저장소를 clone한 뒤 실행되는 Claude Code는 아래 순서를 그대로 수행하십시오.

1. **저장소 루트에서 설치 스크립트를 실행합니다.**
   ```bash
   bash install.sh
   ```
   이 스크립트는 다음을 수행합니다 (여러 번 실행해도 안전합니다):
   - `~/.claude/claude-modes/`에 persona 3종(`CLAUDE_DIGGER.md`, `CLAUDE_DEV.md`, `CLAUDE_PM.md`)과 SessionStart 훅 스크립트를 복사
   - `~/.local/bin/`에 `claude-digger`, `claude-dev`, `claude-pm` 실행 커맨드를 설치
   - `~/.claude/digging/`, `~/.claude/develop/`, `~/.claude/pm-projects/` 데이터 디렉토리와 초기 인덱스 파일 생성
   - `~/.claude/settings.json`에 SessionStart 훅 항목을 **기존 설정을 보존한 채** 병합 (중복 등록 방지)

2. **설치 결과를 확인합니다.**
   ```bash
   cat ~/.claude/settings.json   # hooks.SessionStart 에 session-start-inject.sh 항목이 있는지 확인
   ls ~/.local/bin/claude-*      # claude-digger, claude-dev, claude-pm 존재 확인
   ```

3. **PATH를 확인합니다.** `install.sh`가 `~/.local/bin`이 PATH에 없다고 경고하면, 사용자의 쉘 설정 파일(`~/.bashrc` 등)에 다음을 추가하도록 안내하십시오. 이 파일 수정은 사용자 환경을 바꾸는 작업이므로, 직접 수정하기 전에 사용자에게 확인을 받으십시오.
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

4. **동작을 검증합니다.** 가능하면 `claude-digger --version` 등으로 커맨드가 실행되는지 확인하고, 실제 세션 진입은 사용자가 직접 하도록 안내합니다.

설치가 끝나면 사용자에게 무엇이 설치되었고 어떻게 쓰는지(`claude-digger` / `claude-dev` / `claude-pm`) 요약해 주십시오.

---

## 사용법 (사람용)

```bash
claude-digger    # 조사/지식관리 모드로 세션 시작
claude-dev       # 개발(플래닝→구현→리뷰→회고) 모드로 세션 시작
claude-pm        # 프로젝트 정책/아키텍처 관리 모드로 세션 시작
```

세 명령 모두 일반 `claude` 명령과 동일하게 인자를 그대로 전달합니다 (`claude-dev --resume` 등). 평범하게 `claude`만 실행하면 아무 페르소나도 주입되지 않습니다 — 세 모드는 동시에 활성화되지 않고, 실행한 명령 하나만 해당 세션에 적용됩니다.

---

## 아키텍처

```
claude-<mode> 실행
  └─ export CLAUDE_MODE=<mode>; exec claude
       └─ Claude Code가 SessionStart 훅 실행 (하위 프로세스이므로 CLAUDE_MODE 상속됨)
            └─ hooks/session-start-inject.sh 가 CLAUDE_MODE를 읽어
               해당 persona md 내용을 additionalContext로 stdout에 JSON 출력
                 └─ Claude Code가 이를 시스템 프롬프트에 주입
```

- **모드 전환의 단위는 "실행 커맨드"입니다.** 설정 파일이 아니라 `claude-digger`/`claude-dev`/`claude-pm` 중 무엇으로 세션을 시작했는지가 페르소나를 결정합니다.
- **훅은 전역(`~/.claude/settings.json`)에 한 번만 등록됩니다.** 어느 프로젝트 디렉토리에서 실행하든 동일하게 동작합니다.
- **`~/.claude/pm-projects/`는 의도적으로 `~/.claude/projects/`가 아닙니다.** `~/.claude/projects/`는 Claude Code 자체가 세션 트랜스크립트 저장에 이미 사용하는 내부 경로라, 이름 충돌을 피하기 위해 `pm-projects`로 명명했습니다.
- persona 원본은 이 저장소(`personas/`)에 있고, 설치 시 `~/.claude/claude-modes/personas/`로 복사됩니다. **persona 내용을 수정하려면 이 저장소에서 고친 뒤 `bash install.sh`를 다시 실행**해 설치본을 갱신하십시오.

---

## 저장소 구조

```
claude-code-modes/
├── README.md                       # 이 문서
├── install.sh                      # 설치 스크립트 (idempotent)
├── personas/
│   ├── CLAUDE_DIGGER.md
│   ├── CLAUDE_DEV.md
│   └── CLAUDE_PM.md
├── hooks/
│   └── session-start-inject.sh     # SessionStart 훅 본체
├── bin/
│   ├── claude-digger
│   ├── claude-dev
│   └── claude-pm
└── scripts/
    └── merge-settings.js           # settings.json에 훅을 안전하게 병합
```

## 향후 고도화 예정

- 페르소나별 커스텀 슬래시 커맨드 추가
- `claude-digger` / `claude-dev` / `claude-pm` 각 데이터 디렉토리에 대한 검색/요약 유틸리티
- 여러 페르소나를 조합해서 쓰는 시나리오 지원 여부 검토
