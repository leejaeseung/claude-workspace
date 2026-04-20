# 🏗️ Code Quality Team — 토이 프로젝트 계획서

**작성자**: 김도현 (Code Quality Leader)  
**작성일**: 2026-04-19  
**버전**: v1.0  
**상태**: ARB 승인 완료

---

## 1. 프로젝트 개요

### 배경

Jason Company의 Code Quality 팀이 공식 출범(2026-05-01 예정)하기 전,  
팀원들의 협업 방식과 각 전문 역량을 실제 코드베이스에서 검증하기 위한 **사전 토이 프로젝트**를 진행합니다.

### 프로젝트명

> **"레거시 주문 서비스 구출 작전 (Operation Legacy Rescue)"**

### 대상 레거시 코드

가상의 쇼핑몰 `LegacyOrderService.kt` — 전형적인 God Class 구조:

```
현황 측정 (SonarQube 시뮬레이션):
- Cyclomatic Complexity: 24 (권장: 10 이하)
- 결합도 (Coupling): 9개 책임이 1개 클래스에 혼재
- 테스트 커버리지: 0%
- Lines of Code: ~190 (단일 메서드 ~160줄)
- Code Smells: 17건 (SonarQube 기준)
```

### 목표

1. **이준혁**: Strangler Fig 패턴으로 레거시 코드를 안전하게 분리
2. **박지수**: Strategy + Observer + State 패턴으로 구조 재설계
3. **최아린**: Golden Master → 유닛 테스트로 리팩토링 안전망 구축
4. **김도현**: ARB 의사결정 프로세스 실전 적용 + 팀 운영 가이드 도출

---

## 2. ARB 킥오프 의사결정

**ARB 안건**: `LegacyOrderService` 리팩토링 계획 승인

| 항목 | 결정 |
|------|------|
| 리팩토링 방식 | Strangler Fig (Big Bang 금지) |
| Critical Path 여부 | 해당 없음 (토이 프로젝트, 프로덕션 미적용) |
| Phase 수 | 3 Phase |
| 테스트 안전망 | Phase 0: Golden Master 구축 필수 (최아린) |
| 패턴 도입 기준 | 박지수 "패턴 도입 3기준" 2개 이상 충족 시만 적용 |
| PR 규칙 | 500줄 이내, Critical 주석 3개 이내 (3-30 Rule) |

**ARB 투표**: 김도현(의장) ✅ / 이준혁 ✅ / 박지수 ✅ / 최아린 ✅  
**만장일치 승인**

---

## 3. 역할 분담

| 팀원 | 역할 | 담당 산출물 |
|------|------|-------------|
| **김도현** | 리더, ARB 의장 | PROJECT_PLAN.md, ARB_DECISION.md, 팀 피드백 |
| **최아린** | 테스트 안전망 | Golden Master Tests, 유닛 테스트 전략 |
| **박지수** | 패턴 설계 | 패턴 분석 문서, 리팩토링 설계도 |
| **이준혁** | 리팩토링 실행 | Strangler Fig 구현, 리팩토링 코드 |

---

## 4. 단계별 계획

### Phase 0: 안전망 구축 (최아린 주도)

**기간**: Day 1  
**담당**: 최아린 (Golden Master Test)

```
[최아린 ARB 보고]
- Golden Master Test: 레거시 API 레벨 스냅샷 5건 작성
- 목표: 리팩토링 전후 동일한 출력 보장
- 커버리지 목표: 핵심 플로우 100% (ARB 합의)
- Flaky 위험 요인: 시간 의존성 → TestClock 주입으로 해결
```

완료 조건: Golden Master 테스트 5건 전부 Pass

### Phase 1: 패턴 설계 (박지수 주도)

**기간**: Day 2  
**담당**: 박지수 (OOP 패턴 전문가)

```
[박지수 ARB 안건]
Anti-pattern 분석:
1. God Class → Strategy Pattern (결제 전략 분리)
2. 거대한 if-else 조건문 → State Pattern (주문 상태 머신)
3. 직접 의존 알림 코드 → Observer Pattern (이벤트 기반 알림)

패턴 도입 3기준 검증 후 Phase별 분리 제출
```

완료 조건: PATTERN_ANALYSIS.md, 리팩토링 설계도 작성

### Phase 2: 리팩토링 실행 (이준혁 주도)

**기간**: Day 3  
**담당**: 이준혁 (리팩토링 전문가)

```
[이준혁 ARB 보고]
Strangler Fig 전략:
- 새 OrderProcessor 클래스 생성 (레거시와 병행 운영)
- 박지수 설계의 Strategy/Observer/State 구현
- PR 500줄 제한 준수
- 문서화: 48시간 이내 REFACTORING_LOG.md 작성
```

완료 조건: 리팩토링 코드 PR 완료, 기존 Golden Master 테스트 전부 통과

### Phase 3: 유닛 테스트 완성 (최아린 주도)

**기간**: Day 4  
**담당**: 최아린 (테스트 엔지니어)

```
리팩토링된 각 모듈에 대한 유닛 테스트 작성:
- PaymentStrategy: 3개 구현체 각각
- OrderStateMachine: 상태 전이 시나리오
- OrderEventPublisher: Observer 패턴 동작 검증

커버리지 목표: 80% 이상 (ARB 합의)
```

완료 조건: 유닛 테스트 전부 Pass, 커버리지 80% 이상

---

## 5. 코드 품질 측정 기준 (ARB 합의)

| 지표 | Before | 목표 (After) |
|------|--------|-------------|
| Cyclomatic Complexity | 24 | 8 이하 |
| 단일 클래스 책임 수 | 9개 | 1개 |
| 테스트 커버리지 | 0% | 80% 이상 |
| Lines of Code (최대 메서드) | ~160줄 | 30줄 이하 |
| Code Smells | 17건 | 3건 이하 |

---

## 6. 팀 리더 김도현 메모

> "이 프로젝트의 진짜 목적은 '더 나은 코드'가 아니라 '더 나은 팀'입니다.  
> 각자의 전문성이 서로를 보완하는 선순환 구조를 이번 토이 프로젝트에서 직접 체험해야 합니다.  
> ARB 프로세스를 통해 누구도 혼자 결정하지 않는다는 것을 몸으로 익히세요."

**3-30 Rule 적용 원칙**:
- 코드 리뷰 Critical 주석: 최대 3개
- 주석 길이: 30글자 이내
- 긴 피드백: 1:1 또는 팀 세션에서 구두로

---

**서명**: 김도현 (ARB 의장)  
**날짜**: 2026-04-19
