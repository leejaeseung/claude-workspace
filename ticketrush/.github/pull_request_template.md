## 변경 요약

<!-- 이 PR이 무엇을 변경하는지 한두 문장으로 설명 -->

## 변경 유형

- [ ] 기능 추가 (feat)
- [ ] 버그 수정 (fix)
- [ ] 성능 개선 (perf)
- [ ] 리팩토링 (refactor)
- [ ] 테스트 (test)
- [ ] 문서 (docs)
- [ ] 설정/인프라 (chore)

## BE-FE 계약 변경 체크 (ADR-003)

> `contracts/openapi.yaml` 또는 `event-contract/` 를 변경하면 아래 항목을 모두 완료해야 합니다.

- [ ] 이 PR은 `contracts/openapi.yaml` 또는 `event-contract/`를 변경하지 않습니다 _(변경 없으면 체크 후 아래 항목 무시)_
- [ ] `contracts/openapi.yaml` 변경 완료 (BE 구현보다 먼저)
- [ ] FE 타입 재생성 확인: `pnpm gen:api` 실행 후 에러 없음
- [ ] FE 담당자(@feature-develop-developer-1) 리뷰 요청 완료
- [ ] PR 라벨 `fe-contract-change` 추가

## 테스트

- [ ] 단위 테스트 추가/수정
- [ ] 기존 테스트 모두 통과

## 관련 이슈 / ADR

<!-- 예: ADR-003, #이슈번호 -->
