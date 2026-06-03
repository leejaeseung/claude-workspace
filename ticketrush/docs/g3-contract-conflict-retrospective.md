# G3 갈등 회고 — BE-FE 인터페이스 계약 갈등

**발표자**: 강민서 (feature-develop-developer-1, 미드레벨)  
**발표일**: 2026-06-10 (W5 팀 회고)  
**관련 ADR**: ADR-003 (OpenAPI 계약 소유권)  
**박지훈 KPI 4 연결**: 강민서의 의사결정 범위를 "기술 선택" 단계로 1칸 확장

---

## 무슨 일이 있었나 (사실 분리)

**타임라인**:

```
W4 초반 (2026-06-01):
  하진우 → PaymentConfirmedEvent에 seatId, showId 필드 추가
         → event-contract/ PR 머지

W4 중반 (2026-06-02):
  강민서 → PaymentPage.tsx에서 결제 요청 구현 시작
         → contracts/openapi.yaml 확인: /payments POST에 seatId/showId 없음
         → TypeScript 타입에도 해당 필드 없음
         → 런타임 테스트에서 BE 400/422 오류 발생

W4 후반 (2026-06-03):
  강민서 → 하진우에게 슬랙: "POST /payments에 seatId랑 showId 필요한거 아닌가요?"
  하진우 → "아, event-contract 바꿀 때 openapi.yaml도 같이 바꿨어야 했는데 빠뜨렸다"
  박지훈 → G3 갈등 시나리오로 분류, ADR-003 작성 지시
```

---

## FE 관점에서 본 문제 (강민서 직접 발표)

> *"하진우 시니어가 event-contract를 바꾼 건 맞는 결정이었다. 근데 저는 그 PR을 리뷰하지 못했고, openapi.yaml은 바뀌지 않았고, 저는 구 스펙을 보고 구현을 시작했다."*

**FE 개발자 입장에서 실제로 겪은 것**:

1. `contracts/openapi.yaml`이 소스 오브 트루스라고 믿고 개발을 시작했다.
2. TypeScript 타입(`pnpm gen:api`)은 openapi.yaml 기준으로 생성되었고, `seatId`/`showId` 필드가 없었다.
3. `PaymentPage.tsx`를 작성하며 `seatId`와 `showId`를 전송하지 않는 버전으로 구현했다.
4. 런타임 통합 시점에서 BE 결제 API가 422를 반환했고, 원인 파악에 30분 걸렸다.

**가장 답답했던 점**:
> *"코드 자체의 문제가 아니었다. 스펙 문서가 구식이었던 것이다. 코드 리뷰로는 잡을 수 없는 문제였다."*

---

## 강민서가 제안한 개선사항

G3 발생 후 강민서는 단순히 문제를 보고하는 것을 넘어 **직접 해결책을 제안**했다.

### 제안 1: CODEOWNERS로 리뷰 강제

```
# .github/CODEOWNERS
contracts/openapi.yaml   @feature-develop-developer-2 @feature-develop-developer-1
event-contract/          @feature-develop-developer-2 @feature-develop-developer-1
```

**근거**: "슬랙 알림은 묻힌다. CODEOWNERS는 PR 머지 자체를 막는다. 강제성이 있어야 한다."

→ **박지훈 평가**: "프로세스 개선 제안이 기술적으로 정확하고, 강제성 수준도 적절하다. 바로 채택."

### 제안 2: Contract-First 원칙 명문화

> *"BE가 event-contract를 바꾸면, 그 PR에 openapi.yaml 변경도 함께 포함되어야 한다. 두 PR이 분리되는 순간 틈이 생긴다."*

→ ADR-003 "Contract-First 변경 절차" 섹션으로 반영됨.

### 제안 3: PR 템플릿 체크박스

"매번 CODEOWNERS가 alert를 보내더라도, 작성자 스스로 'openapi.yaml 바꿨나?' 체크하는 습관이 중요하다. PR 템플릿이 리마인더 역할을 한다."

→ `.github/pull_request_template.md` 생성됨.

---

## 회고 결과 — 강민서 의사결정 범위 확장

**박지훈 평가** (KPI 4 연결):

> *"이번 G3에서 강민서가 단순히 버그 리포트를 한 것이 아니라, 해결책까지 직접 제안하고 팀 프로세스 변경으로 이어지게 했다. 이것은 '구현'에서 '프로세스 설계'로 한 단계 올라간 것이다.*
>
> *앞으로 BE-FE 계약 관련 변경에서는 강민서가 openapi.yaml 초안 작성 권한을 갖는다. 하진우나 나의 검토를 받되, 강민서가 먼저 스펙을 작성하고 BE가 그에 맞춰 구현하는 방식으로 전환한다."*

**강민서 소감**:
> *"저는 FE 미경험자로 시작했는데, 이번에 FE 관점에서 계약 변경의 영향을 직접 겪고 나서 왜 Contract-First가 중요한지 확실히 이해했다. 앞으로 계약 관련해서는 FE 입장을 더 적극적으로 말하겠다."*

---

## G3 갈등 조율 프로세스 적용 체크

| 단계 | 완료 여부 | 비고 |
|------|----------|------|
| 1. 사실 분리 | ✅ | 타임라인 재구성, 책임 소재 명확화 |
| 2. 데이터 수집 합의 | ✅ (논리) | PoC 불필요 — openapi.yaml 불일치가 명백한 사실 |
| 3. ADR 작성 | ✅ | ADR-003 |
| 4. 결정 후 회고 | ✅ | 본 문서 |
| 5. 패턴화 | ✅ | conflict-resolution-process-v1.md에 반영 |

---

## 이후 변경사항 (G3 조율 완료 산출물)

1. `contracts/openapi.yaml` — `POST /payments` 스펙에 `seatId`, `showId` 추가
2. `contracts/openapi.yaml` — `POST /seats/{seatId}/lock` 스펙에 `showId` 추가 및 응답 스키마 보강
3. `.github/CODEOWNERS` — 계약 파일 변경 시 FE 필수 리뷰 강제
4. `.github/pull_request_template.md` — BE-FE 계약 변경 체크박스
5. ADR-003 항목 `[x] .github/CODEOWNERS 파일 생성` 완료 처리

*본 문서는 박지훈 KPI 4 "팀원 의사결정 위임 범위 1단계 이상 확장"의 G3 사례 기록이다.*
