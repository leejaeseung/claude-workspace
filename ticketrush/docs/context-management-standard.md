# Context 관리 표준 v1

**작성자**: 박지훈 (feature-develop 팀 리더)  
**작성일**: 2026-06-16 (W6)  
**KPI 연결**: 박지훈 KPI 5 — 작업 맥락 템플릿 도입 및 LLM 토큰 사용량 20% 이상 절감  
**적용 범위**: LLM(Claude Code)을 활용하는 모든 개발 작업

---

## 1. 도입 배경

LLM 기반 개발 도구(Claude Code)를 팀 전체가 사용하면서 세 가지 문제가 반복됐다:

1. **컨텍스트 중복 설명**: 같은 도메인 규칙(Kafka 토픽 구조, Arrow-kt DomainError 패턴 등)을 매 세션마다 다시 설명
2. **긴 초안 생성 후 폐기**: LLM이 프로젝트 규약을 모르고 생성한 코드를 대폭 수정
3. **완료 기준 불명확**: 작업 중 범위가 확장되거나 예상치 못한 방향으로 진행

**측정 결과** (W3~W5, 강민서·하진우·박지훈 합산):
- 평균 세션 당 초기 컨텍스트 설명: **약 2,400 토큰**
- 템플릿 적용 후 측정 목표: **≤ 1,920 토큰** (20% 이상 절감)

---

## 2. 작업 맥락 템플릿

모든 LLM 세션 시작 시 아래 템플릿을 붙여 사용한다.

```markdown
## 작업 맥락

**목표**: [한 문장 — 이 세션에서 달성할 것]

**제약**:
- 프로젝트: TicketRush (Kotlin/Spring Boot/Kafka/WebFlux)
- 모듈: [해당 모듈명, 예: order-api]
- 규약: [Arrow-kt Either / Kotest + Mockito / KafkaTemplate.send 패턴 등]

**참고 파일**:
- [파일 경로 1]: [한 줄 설명]
- [파일 경로 2]: [한 줄 설명]

**완료 기준**:
- [ ] [검증 가능한 조건 1]
- [ ] [검증 가능한 조건 2]
```

---

## 3. 팀원별 사용 예시

### 강민서 — 좌석 도메인 단위 테스트 작성

```markdown
## 작업 맥락

**목표**: OrderCreatedConsumer 단위 테스트 5건 작성 (Kotest DescribeSpec)

**제약**:
- 모듈: seat-api/src/test
- 테스트 스타일: Kotest DescribeSpec, 각 it() 블록에 fresh mock 생성
- Mock 라이브러리: org.mockito.kotlin (whenever, verify, mock<T>())
- SeatEntity: @Version 필드 있음, BaseEntity 상속 (createdAt/updatedAt 자동 설정)

**참고 파일**:
- seat-api/src/main/kotlin/.../consumer/OrderCreatedConsumer.kt: 테스트 대상
- order-api/src/test/.../service/OrderServiceTest.kt: 패턴 참고
- core-domain/.../error/DomainError.kt: Left 케이스 검증에 사용

**완료 기준**:
- [ ] AVAILABLE → LOCKED 정상 전이
- [ ] 동일 orderId 중복 수신 → save() 미호출
- [ ] 다른 orderId 선점 → 상태 불변 확인
- [ ] CONFIRMED 좌석 → 무시
- [ ] DB 미존재 seatId → 예외 없이 종료
```

**절감 포인트**: "Kotest DescribeSpec 패턴이 뭔지 설명", "SeatEntity 구조 설명" 등 약 800토큰 생략 가능.

---

### 하진우 — Kafka 파티셔닝 ADR 작성

```markdown
## 작업 맥락

**목표**: order.created 토픽 파티션 6 → 12 증설 ADR 작성

**제약**:
- ADR 형식: docs/adr/ADR-NNN-*.md (상태/날짜/참여자/컨텍스트/결정옵션/결정/구현/파급효과)
- 기존 ADR 참고: ADR-002 (파티션 키 결정), ADR-006 (성능 튜닝)
- Kafka 설정 위치: infra-kafka/KafkaTopicConfig.kt

**참고 파일**:
- docs/w5-kafka-consumer-lag-analysis.md: 파티션 증설 근거
- infra-kafka/KafkaTopicConfig.kt: 현재 설정

**완료 기준**:
- [ ] 파티션 6 → 12 결정 근거 (Consumer 처리 병렬성 향상)
- [ ] 순서 보장 변경점 명시 (userId 기반 순서 → 없음)
- [ ] KafkaTopicConfig.kt 변경 포함
```

---

### 박지훈 — G4 갈등 조율 보고서 작성

```markdown
## 작업 맥락

**목표**: G4 갈등(PO 기능 요청 vs 성능 튜닝 우선) 조율 결과 문서화

**제약**:
- 갈등 조율 프로세스 v1 5단계 형식 준수 (docs/conflict-resolution-process-v1.md)
- 파일 위치: docs/g4-po-feature-request-conflict.md
- 비즈니스 언어 번역 패턴 포함 (기술 지표 → 사용자 영향)

**참고 파일**:
- docs/conflict-resolution-process-v1.md: 프로세스 형식
- docs/w5-load-test-result.md: consumer lag 측정값 근거

**완료 기준**:
- [ ] 사실 분리 (PO 주장 vs 박지훈 입장)
- [ ] 데이터 기반 합의 조건 명시
- [ ] 연기 결정 + W8 약속 명시
```

---

## 4. 절감 메커니즘 분석

| 항목 | 템플릿 없음 | 템플릿 있음 | 절감 |
|------|-----------|-----------|------|
| 프로젝트 구조 설명 | ~400 토큰 | 0 (참고 파일 경로로 대체) | -400 |
| 패턴 설명 (Arrow-kt Either 등) | ~600 토큰 | 0 (규약란에 키워드만) | -600 |
| 완료 기준 협의 | ~300 토큰 | 0 (미리 체크박스 정의) | -300 |
| 범위 재협의 | ~500 토큰 | ~100 토큰 (엣지케이스만) | -400 |
| **합계** | **~1,800 토큰** | **~100 토큰** | **-1,700 토큰** ✅ |

*측정 방법: 세션 시작 전후 Claude Code의 토큰 사용량 비교. W6~W7에서 팀 전체 3인 기준 측정.*

---

## 5. 적용 규칙

### 의무 적용 상황

- 새 기능 구현 (PR 단위)
- 리팩토링 (범위가 2개 파일 이상)
- 버그 수정 (원인 분석 + 수정)
- 문서 작성 (ADR, 회고, 가이드)

### 선택 적용 상황

- 단순 타이포 수정
- 1줄 config 변경
- 주석 수정

### 금지 사항

- 완료 기준 없이 세션 시작
- "그냥 알아서 해줘" 형태의 지시
- 참고 파일 없이 도메인 로직 설명 반복

---

## 6. 측정 및 점검 계획

### W6 중간 측정 (2026-06-18)
- 강민서, 하진우, 박지훈 각 2개 세션 측정
- 템플릿 사용 vs 미사용 토큰 비교

### W8 최종 측정 (2026-07-03)
- 분기 전체 LLM 사용량 집계
- KPI 5 달성 여부 판정: 초기 세션 컨텍스트 토큰 20% 이상 절감

### KPI 5 달성 기준
```
(템플릿_없는_평균_컨텍스트_토큰 - 템플릿_있는_평균_컨텍스트_토큰)
─────────────────────────────────────────────────────────────────── ≥ 0.20
              템플릿_없는_평균_컨텍스트_토큰
```

---

## 7. 하진우·강민서 코칭 계획 (KPI 7 연결)

> 박지훈: "Context 관리는 단순한 도구 사용법이 아니다. 작업 범위를 명확히 정의하는 사고 습관이다."

| 팀원 | 코칭 내용 | 일정 |
|------|---------|------|
| 강민서 | 완료 기준 작성 연습 (검증 가능한 체크박스 정의) | W6 1:1 |
| 하진우 | 참고 파일 최소화 전략 (핵심 2개만) | W6 1:1 |

*본 문서는 박지훈 KPI 5 "Context 관리 표준 수립 — 작업 맥락 템플릿 도입 및 분기별 LLM 토큰 사용량 20% 이상 절감 측정·공유"의 공식 산출물이다.*
