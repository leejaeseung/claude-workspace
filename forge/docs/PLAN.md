# Forge 계획서

> 최초 작성: 2026-10-17 · 브랜치: `feature/forge`
> 사람용 체크리스트(명령어 포함): [`plan.html`](./plan.html)
> 이 문서는 새 Claude 세션이 맥락 없이도 작업을 이어갈 수 있도록 작성한다. 결정이 바뀌면 이 문서를 먼저 고친다.

## 1. 목표

- Hetzner Cloud 서버 1대에서 AI 에이전트(Claude)가 돌아가고, **Android 앱으로 원격 명령**을 내린다.
- 에이전트는 명령으로 만들어진 **모바일 앱 프로젝트들을 서버에서 관리**한다(생성, 수정, 테스트, PR, 배포).
- (선택) 명령이 없어도 이미 있는 프로젝트를 **스스로 조금씩 개선**한다(자율 루프).

## 2. 확정된 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 사용자 기기 | **Android만** | iOS 개발자 계정 불필요 |
| 관리 대상 프로젝트 | **Expo(React Native) 모바일 앱**, 각 앱 사용자 최대 2명 | 스토어 배포 불필요, 백엔드 최소화 |
| 비용 목표 | **월 총 1.4만~2만원** (서버 + API) | 사용자 요구 |
| 서버 | Hetzner **CX23** (2 vCPU / 4GB) + swap 2GB, Ubuntu 24.04. 품절 시 CAX11(ARM) | 로컬 Android 빌드를 하지 않으므로 4GB면 충분 |
| 네트워크 | **Tailscale**. 공개 포트는 SSH 하나뿐(나중에 닫을 수 있음) | 인증 부담과 공격면 감소 |
| 에이전트 실행 | **러너 2가지 모드**: ① 구독 모드(`claude` CLI 헤드리스, 기존 구독 사용) ② API 모드(Claude Agent SDK) | 구독 모드로 시작해 API 비용 0원, 한도가 충돌하면 API 모드로 전환 |
| 모델 (API 모드) | 기본 **Claude Haiku 5.5**(`claude-haiku-5-5`), 앱에서 "고급"을 고르면 **Claude Sonnet 5.5**(`claude-sonnet-5-5`) | Haiku는 $0.10/$0.50 per MTok으로 Sonnet보다 약 20배 저렴 |
| 서버 스택 | Node 22, TypeScript, **Hono**, **SQLite**(Drizzle) | 1인용이라 충분하고 백업이 쉬움 |
| 격리 | 전용 리눅스 계정 `forge`(sudo 없음) + 에이전트 권한 규칙. **Docker는 사용 안 함** | 4GB RAM 절약 |
| 알림 | **ntfy** (서버 self-host, `:2586`, 토픽 `forge`, Tailscale 내부 전용) | FCM 설정 불필요 |
| 미리보기 | 서버 Metro → 휴대폰 **Expo Go** (`REACT_NATIVE_PACKAGER_HOSTNAME=<Tailscale IP>`) | 빌드 없이 즉시 확인 |
| 배포 | APK는 최초 1회와 네이티브 변경 시에만 **EAS Build**(무료 Android 월 15회). 이후에는 **EAS Update(OTA)** | 무료 범위 안에서 운영 |
| 앱 데이터 | 기기 로컬 저장이 우선. 2인 공유가 필요하면 같은 서버에 Hono + SQLite, 상대방을 Tailscale에 초대 | 외부 BaaS 불필요 |
| GitHub | Forge 전용 **조직** + 그 조직만 접근하는 fine-grained PAT | 에이전트 토큰을 개인 repo와 분리 |
| 앱 템플릿 | 모든 프로젝트를 **공통 Expo 템플릿**에서 시작(knowledge-cards 구조 기반) | 캐시 적중률 상승, 탐색 토큰 절약 |

## 3. 아키텍처

```
[Forge 앱 (Android, Expo)] ──Tailscale──┐
[Expo Go (미리보기)] ────────────────────┤
                                        ▼
┌──────── Hetzner CX23 (2 vCPU / 4GB + swap 2GB) ────────┐
│ API Server (Hono) ── 예산 관리자 (일/월 한도)             │
│ Job Queue (SQLite)                                      │
│ Agent Runner ─ 구독 모드 (claude CLI)                    │
│              └ API 모드 (Agent SDK: Haiku 기본/Sonnet 선택)│
│ 사전 점검기: tsc / eslint / jest (LLM 호출 전 실행)        │
│ Metro (미리보기 1개씩) · ntfy (알림)                       │
│ /srv/projects/<app>  ← 공통 Expo 템플릿에서 생성           │
└─────────────────────────────────────────────────────────┘
        │ git push / PR             │ eas build(최초 1회) / eas update(OTA)
        ▼                           ▼
   GitHub (Forge 조직)        두 사용자의 Android 폰
```

### 도메인 모델 (초안)

```
Project : id, name, repoPath, githubRemote, status, autonomyLevel(0-3), dailyBudgetUsd
Task    : id, projectId, prompt, source(user|auto), model, status(queued|running|waiting_approval|done|failed), branch, costUsd
Session : id, taskId, runnerMode(cli|api), resumeId, startedAt, endedAt
Event   : id, sessionId, type(text|tool_use|tool_result|error), payload, ts
Approval: id, taskId, kind(merge|deploy|dangerous_cmd), status
```

각 프로젝트 루트에는 `CLAUDE.md`(규칙과 실행 방법), `BACKLOG.md`(할 일, 크기 태그 `[S]`/`[M]`/`[L]`), `.forge/journal.md`(에이전트 작업 일지)를 둔다.

## 4. 비용

| 항목 | 최소 | 표준 |
|---|---|---|
| Hetzner CX23 + IPv4 (2026-08 기준 약 €5.49 + IPv4) | ≈ €6 | ≈ €6 |
| 직접 명령, Haiku 5.5 (건당 약 $0.02~0.05, 추정) | 40건 · $2 | 40건 · $2 |
| 직접 명령, Sonnet 5.5 (건당 약 $0.3~0.6, 추정) | 0건 | 8건 · $4 |
| 자율 루프, Haiku 5.5 | 주 2회 · $0.3 | 매일 · $1 |
| Tailscale · ntfy · GitHub · EAS | 0 | 0 |
| **합계** | **≈ 1.4만원** | **≈ 2만원** |

구독 모드만 쓰면 서버비(≈ 9,500원)만 든다. 건당 단가는 추정치이며 **T5.3에서 실측값으로 교체**한다.

**비용 장치 (필수)**
1. (API 모드) Anthropic Console 월 지출 한도 $10
2. Forge 내부 예산 관리자: 작업마다 비용을 기록하고, 월 예산의 80%에 도달하면 자율 루프를 중지하고 ntfy로 알림
3. 사전 점검(tsc/lint/jest)을 셸로 먼저 실행해 할 일이 없으면 LLM을 호출하지 않음
4. `maxTurns` 상한: Haiku 15, Sonnet 25. effort는 `low`/`medium`

## 5. 작업 목록과 상태

상태: ⬜ 대기 · 🟨 진행 중 · ✅ 완료 · ⏭️ 생략

| ID | 작업 | 담당 | 상태 | 완료 기준 |
|---|---|---|---|---|
| T1 | 계정 준비 (Hetzner, Tailscale, Expo, GitHub 조직 + PAT, Anthropic 결정) | 사람 | ⬜ | 각 서비스 로그인 가능 |
| T2 | 휴대폰·PC 준비 (Tailscale, ntfy, Expo Go) | 사람 | ⬜ | 휴대폰과 PC가 tailnet에 표시됨 |
| T3.1 | `forge/infra/bootstrap.sh` 작성 | Claude | ✅ | 커밋 `57d4913` |
| T3.2 | 서버 생성과 bootstrap 실행, 로그인(claude/gh/eas) | 사람 | ⬜ | ntfy 테스트 알림 수신, `ssh admin@<Tailscale IP>` 성공 |
| T4 | Remote Control + Expo Go로 1주 시험 사용, 불편 사항 메모 | 사람 | ⬜ | 불편 사항 목록 (T6.1 입력) |
| T5.1 | 공통 Expo 템플릿 | Claude | ⬜ | 아래 상세 참고 |
| T5.2 | Forge 서버 (API, 큐, 러너 2모드, 예산 관리자, ntfy) | Claude | ⬜ | 아래 상세 참고 |
| T5.3 | 서버 배포, 작업 10건 실측, 비용표 갱신 | 사람 + Claude | ⬜ | 4장 비용표가 실측값으로 바뀜 |
| T6.1 | Forge Android 앱 | Claude | ⬜ | 아래 상세 참고 |
| T6.2 | Forge 앱 APK 설치, 첫 실사용 앱 제작 및 2인 배포 | 사람 | ⬜ | 두 사람 폰에 설치, OTA 업데이트 1회 성공 |
| T7.1 | 자율 개선 루프 (선택) | Claude | ⬜ | 아래 상세 참고 |
| T7.2 | 자율 루프 2주 관찰과 주기·예산 조정 (선택) | 사람 | ⬜ | 조정값을 이 문서에 기록 |

### T5.1 공통 Expo 템플릿
- 위치: `forge/template/` (서버에서 새 프로젝트를 만들 때 복사)
- 기반: `knowledge-cards`의 설정(eslint, tsconfig, eas.json, expo-router)
- 포함: TypeScript, ESLint, Jest(샘플 테스트 1개), EAS Update 설정, `preview` 빌드 프로필(APK)
- 짧고 고정된 `CLAUDE.md`, 형식이 정해진 `BACKLOG.md`(`[S]`/`[M]`/`[L]` 태그), `.forge/journal.md`
- 스크립트: `npm run check` = `tsc --noEmit && eslint . && jest` (사전 점검기가 이것만 호출)
- **Expo Go와 호환**되어야 함 (네이티브 커스텀 모듈 없음)
- 완료 기준: 템플릿 복사 → `npm install` → `npm run check` 통과 → Expo Go에서 실행

### T5.2 Forge 서버
- 위치: `forge/server/` (TypeScript, Hono, SQLite + Drizzle)
- API: `POST /projects`(템플릿 복사 + git init + GitHub 조직에 repo 생성), `GET /projects`, `POST /projects/:id/tasks`, `GET /tasks/:id/events`(SSE), `POST /approvals/:id`, `GET /budget`
- 인증: 정적 Bearer 토큰 (Tailscale 내부 전용이므로 1차로 충분)
- 큐: 프로젝트당 동시 1개, 전체 동시 1개 (4GB RAM)
- 러너 인터페이스 하나에 구현 2개: `CliRunner`(`claude -p` 헤드리스, 구독), `SdkRunner`(Agent SDK, API 키). 환경변수로 선택
- 작업마다 `forge/<task-id>` 브랜치를 만들고, 완료 시 PR 생성. main 머지는 승인 API로만
- 예산 관리자: 결과의 비용과 토큰을 Task에 기록하고, 일·월 한도를 넘으면 큐 진입을 거부
- 위험 명령 차단: `rm -rf /`, `git push --force`, `sudo` 등. 프로젝트 디렉터리 밖에는 쓰기 금지
- ntfy 알림: 완료, 실패, 승인 필요, 예산 80%
- systemd 유닛 파일과 배포 방법 문서 포함
- **구현 전에 설계 요약을 사용자에게 보여주고 확인받는다.**
- 완료 기준: curl로 "메모 앱 만들어줘"를 보내면 결과가 커밋되고 PR이 생기며, 비용이 기록되고 ntfy 알림이 온다.

### T6.1 Forge Android 앱
- 위치: `forge/app/` (Expo, Android 전용)
- 화면: 프로젝트 목록(상태 배지, 비용) · 새 프로젝트 · 프로젝트 상세(명령 입력 + 실시간 로그 + 히스토리 + 모델 선택 Haiku/Sonnet) · 승인함(diff 요약) · 이번 달 사용액 게이지 · 설정(서버 주소, 토큰, 프로젝트별 자율 레벨)
- "미리보기 열기": 서버에 Metro 시작을 요청한 뒤 Expo Go 딥링크(`exp://<Tailscale IP>:<port>`)로 연다
- "업데이트 배포": 서버에서 `eas update` 실행
- **T4의 불편 사항 목록을 요구사항에 반영한다.**
- 완료 기준: 휴대폰에서 명령 → 로그 확인 → 완료 알림 → PR 승인 → OTA 배포까지 한 번에 동작

### T7.1 자율 개선 루프 (선택)
- 주 2회 새벽, 프로젝트 1개씩 순서대로 처리
- 흐름: `npm run check` → 실패하면 Haiku로 수정, 통과하면 BACKLOG의 `[S]` 항목 1개 처리 → 테스트 통과 시 PR → journal 기록 → 아침 ntfy 요약
- 기본 자율 레벨은 2(PR까지). 3회 연속 실패하면 해당 프로젝트의 루프를 자동으로 끔
- 자율 예산: 일 $0.15, 월 $4. 배포, 결제, 비밀값 변경은 항상 승인 필요
- **예산 한도와 안전장치를 먼저 구현하고, 루프는 그다음에 붙인다.**

## 6. 열린 질문

- Forge 코드(`forge/server`, `forge/app`)를 서버에 어떻게 배포할지: 현재 repo를 clone하거나 별도 repo로 분리. **T5.2 시작 시 결정.**
- 구독 모드의 자동화 사용이 현재 약관에 맞는지는 T3.2 이후 확인한다. 문제가 있으면 API 모드를 기본으로 한다.

## 7. 진행 기록

| 날짜 | 내용 |
|---|---|
| 2026-10-17 | 계획 수립, 비용 최소화 구성 확정, `bootstrap.sh` 작성(T3.1) |
