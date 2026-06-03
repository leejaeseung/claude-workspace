# ADR-003: OpenAPI 계약 소유권과 변경 프로세스

- **상태**: 확정 (Accepted)
- **작성일**: 2026-05-10
- **참여자**: feature-develop-leader, feature-develop-developer-2(하진우), feature-develop-developer-1(강민서)
- **갈등 유형**: G3 — BE 스키마 변경 → FE 빌드 실패 시나리오

---

## 발생한 문제 (갈등 시나리오)

하진우가 `payment-api`에 `seatId`, `showId` 필드를 `PaymentConfirmedEvent`에 추가하면서 `event-contract` 모듈을 수정했다. 이 변경은 `seat-api`의 `PaymentConfirmedConsumer`가 올바르게 작동하기 위해 필요했지만, 동시에:

1. `contracts/openapi.yaml`의 `POST /payments` request body에도 `seatId`, `showId`가 추가되어야 했다.
2. FE의 `PaymentPage.tsx`가 이 필드들을 request body에 포함시켜야 했다.
3. FE는 BE 변경 사실을 PR 리뷰 전까지 몰랐다 → **FE 빌드 통합 시점에서 런타임 오류 발생** 가능성.

---

## 근본 원인

- `event-contract/` 변경과 `contracts/openapi.yaml` 변경이 **별도 PR**로 분리되었음
- `contracts/openapi.yaml`에 CODEOWNERS가 없어 FE 리드 리뷰 없이 머지 가능했음
- "BE가 먼저 바꾸고, FE에게 슬랙으로 알린다"는 암묵적 규칙 → 신뢰 기반으로만 동작

---

## 결정

### 1. CODEOWNERS 적용 (`.github/CODEOWNERS`)

`contracts/openapi.yaml`, `contracts/sse-events.md`, `event-contract/` 변경에 대해 BE 리드 + FE 리드 동시 승인을 강제한다.

```
contracts/openapi.yaml    @feature-develop-leader @feature-develop-developer-2
event-contract/           @feature-develop-developer-2 @feature-develop-developer-1
```

GitHub의 Branch Protection Rule에서 `Require review from Code Owners`를 활성화하면 CODEOWNERS에 지정된 리뷰어 승인 없이는 머지 불가능.

### 2. Contract-First 변경 절차

```
1. contracts/openapi.yaml 먼저 수정 (PR 오픈)
2. FE 리드 + BE 리드 동시 리뷰 후 머지
3. BE 구현 PR (event-contract + 서비스 코드)
4. FE 구현 PR (페이지/훅 코드)
5. 통합 테스트
```

순서를 강제하는 이유: 계약이 먼저 정해져야 BE/FE가 병렬 개발 가능.

### 3. 스키마 호환성 규칙

| 변경 유형 | 위험도 | 절차 |
|----------|--------|------|
| 필드 추가 (optional) | 낮음 | CODEOWNERS 리뷰 후 머지 |
| 필드 추가 (required) | 높음 | FE 동시 PR 필수, feature flag 검토 |
| 필드 삭제/이름변경 | 매우 높음 | Deprecation 주기 최소 1 스프린트 |
| 타입 변경 | 매우 높음 | 새 필드 병행 → 구 필드 deprecate 순서 |

---

## 구현 체크리스트

- [x] `.github/CODEOWNERS` 파일 생성 (2026-06-10)
- [ ] GitHub Branch Protection: `Require review from Code Owners` 활성화 (로컬 환경 한계 — 팀 GitHub 조직 필요)
- [x] PR 템플릿에 "계약 변경 여부" 체크박스 추가 (`.github/pull_request_template.md`)
- [x] `contracts/openapi.yaml` 스키마 수정: POST /payments에 seatId/showId 추가 (G3 실제 수정)
- [x] `contracts/openapi.yaml` 스키마 수정: POST /seats/{id}/lock에 showId + 응답 스키마 보강
- [ ] `openapi-typescript` CI 자동화 (`pnpm gen:api` → FE 타입 갱신) — W6 예정

---

## 교훈

CODEOWNERS는 "신뢰"를 "프로세스"로 변환한다. 팀이 작을 때는 슬랙 메시지로 충분하지만, 병렬 개발이 늘어날수록 사람이 기억하는 규칙은 깨진다. CODEOWNERS는 PR 단계에서 강제 검토를 자동화하여 런타임까지 문제가 늦게 발견되는 것을 막는다.
