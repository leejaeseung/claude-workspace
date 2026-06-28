# TicketRush — 프로젝트 구상안 최종 (v2.0)

> 작성자: 박지훈 (feature-develop 팀 리더)
> 확정일: 2026-05-05
> 버전: v2.0 (FE 내재화 반영)
> 변경 이력: v1.0 → v2.0
> - v2.0 변경점: (1) 도메인 가계부 앱 → TicketRush 교체, (2) FE 외부 위임 → 팀 내부 직접 개발, (3) 갈등 시나리오 G1~G4 4건 전부 포함, (4) 부하 테스트 환경 로컬(Docker Compose + k6) 확정

---

## 1. 프로젝트 개요

### 1.1 정체성
**TicketRush**는 한정 수량 티켓의 폭발적 동시 구매(rush) 트래픽을 처리하는 티켓팅 플랫폼이다. "재고는 적고, 구매자는 많다"는 단일 제약 위에 분산락·이벤트 일관성·실시간 좌석 상태 동기화·결제 이중화 방지를 동시에 풀어야 하는 도메인이다.

### 1.2 선정 근거
- 가계부 앱 대비 **기술 난이도가 한 단계 높다**: 동시성·일관성·지연시간이 비즈니스 가치에 직결.
- KPI 본질(Kafka 이벤트 아키텍처, 성능 튜닝, 모듈 경계, Arrow-kt, 모니터링)을 그대로 충족할 수 있는 도메인.
- FE에서도 좌석 점유 SSE/WebSocket, 대기열 UX, 결제 전환 등 **실제 학습 가치가 큰 화면 요구**가 발생.

### 1.3 비즈니스 시나리오 (모의)
- 인기 공연 티켓 1,000매 한정 오픈, 동시 접속 3만 명 가정 (로컬 환경에서 k6로 시뮬레이션).
- 좌석 선점 → 5분 결제 마감 → 결제 완료 시 확정, 미완료 시 자동 해제.
- 동일 좌석 중복 점유 0건, 결제 이중화 0건이 비즈니스 SLA.

### 1.4 프로젝트 기간 및 인원
- **기간**: 8주 (2026-05-11 ~ 2026-07-05)
- **인원**: 박지훈(리더), 하진우(시니어), 강민서(미드)
- **FE 주체**: 팀 내부 직접 개발 — FE 역량 향상이 부수 목표

---

## 2. 고복잡도 기술 난제 (7가지)

| # | 난제 | 핵심 어려움 | 검증 지표 |
|---|------|-------------|-----------|
| C1 | 좌석 동시 점유 방지 | 분산락 vs DB 비관락 vs Redis Lua의 트레이드오프 | 동일 좌석 중복 점유 0건 (k6 부하) |
| C2 | 결제 이중 방지 | 결제 idempotency-key 설계, 외부 결제 PG 재시도 처리 | 동일 주문 결제 호출 1회로 수렴 |
| C3 | Kafka 이벤트 일관성 | 좌석 점유 → 결제 → 확정 사이의 saga/outbox 패턴 | 부분 실패 복구 시나리오 100% 통과 |
| C4 | 좌석 상태 실시간 동기화 | SSE vs WebSocket 선택, Backpressure 처리 | 좌석 상태 갱신 지연 P99 ≤ 500ms |
| C5 | 대기열(queue) 시스템 | Redis Sorted Set 기반 가상 대기열, 순번 보장 | 새치기 0건, 진입 순서 단조 증가 |
| C6 | JVM/GC 튜닝 | 폭발적 트래픽에서 G1 vs ZGC, heap 크기 결정 | P99 응답시간 < 800ms (로컬 k6 기준) |
| C7 | Kafka Consumer lag 통제 | 파티셔닝 키 설계, Consumer 그룹 스케일링 | 피크 시 lag < 5,000건, 60초 내 회복 |

---

## 3. 시스템 아키텍처

### 3.1 컴포넌트 다이어그램 (텍스트)
```
[Browser/FE]
    │  HTTP/SSE
    ▼
[BFF/Gateway: Spring WebFlux]
    │
    ├─ [Queue Service]   ── Redis (Sorted Set 대기열)
    ├─ [Seat Service]    ── PostgreSQL (좌석 마스터)
    │                    ── Redis (좌석 점유 캐시 + Lua 분산락)
    ├─ [Order Service]   ── PostgreSQL (주문)
    │                    ── Kafka [order.created, order.expired]
    ├─ [Payment Service] ── External PG (Mock)
    │                    ── Kafka [payment.requested, payment.confirmed]
    └─ [Notification]    ── SSE Push (좌석 상태 broadcast)
                         ── Kafka [seat.changed]

[Kafka Cluster] ── [Outbox Relay] ── [Saga Orchestrator]
[Grafana + Prometheus + Loki] (로컬 Docker Compose)
```

### 3.2 모듈 경계 (Gradle 멀티모듈)
- `:core-domain` (좌석/주문/결제 도메인 모델)
- `:queue-api` (대기열)
- `:seat-api` (좌석)
- `:order-api` (주문)
- `:payment-api` (결제)
- `:notification-api` (SSE)
- `:event-contract` (Kafka 이벤트 스키마)
- `:infra-kafka` / `:infra-redis` / `:infra-jpa`
- `:web-fe` (FE 프로젝트, Vite + React)

### 3.3 인프라 구성 (로컬 Docker Compose)
- PostgreSQL 16, Redis 7, Kafka 3.7 (KRaft), Prometheus, Grafana, Loki, k6
- 단일 `docker-compose.yml` 1회 명령으로 기동 (부록 10 참고)

---

## 4. BE 아키텍처 상세

### 4.1 모듈 경계 원칙
- **이벤트 기반 통신을 1순위**, REST는 BFF ↔ FE 구간만 사용.
- 도메인 모듈은 다른 도메인 모듈을 직접 참조 금지. 통신은 `:event-contract` 경유.

### 4.2 Kafka 토픽 / 파티셔닝
| 토픽 | 파티션 | 키 | 보관 | 용도 |
|------|--------|----|------|------|
| `seat.changed` | 12 | `eventId` | 1d | 좌석 상태 broadcast |
| `order.created` | 12 | `userId` | 7d | 주문 생성 |
| `order.expired` | 12 | `orderId` | 7d | 5분 만료 처리 |
| `payment.requested` | 6 | `orderId` | 7d | 결제 요청 |
| `payment.confirmed` | 6 | `orderId` | 30d | 결제 확정 |
| `outbox.relay` | 6 | `aggregateId` | 1d | 트랜잭셔널 outbox |

**파티셔닝 결정 근거**: `seat.changed`는 이벤트(공연) 단위 fan-out이 많아 `eventId`. 주문/결제는 사용자 또는 주문 ID로 순서 보장. ADR로 문서화 예정.

### 4.3 이벤트 흐름 (좌석 점유 → 결제 확정)
1. 사용자 좌석 점유 요청 → `Seat Service`가 Redis Lua로 분산락 획득.
2. `:order-api`가 주문 생성 + outbox row 기록 (단일 트랜잭션).
3. `outbox.relay` consumer가 `order.created` 발행.
4. 5분 timer (Redis TTL or Kafka delayed) → 만료 시 `order.expired` 발행.
5. 결제 요청 → `payment.requested` → PG 호출 → `payment.confirmed`.
6. `Seat Service`가 `payment.confirmed` consume → 좌석 상태 `CONFIRMED` 전이 + `seat.changed` 발행.

### 4.4 Arrow-kt 적용 포인트
- `Either<DomainError, Order>`: 주문 생성 검증 (좌석 가용성 + 사용자 자격 + 가격).
- `Validated<NonEmptyList<ValidationError>, SeatSelection>`: 다중 좌석 선택 검증.
- `Effect<DomainError, A>`: saga 단계의 부분 실패 합성.
- 적용 범위: 첫 2주 차에 박지훈이 `:order-api` 모듈에서 파일럿, 3주 차 공유 세션 후 확산.

### 4.5 성능 튜닝 타깃 (로컬 k6 기준)
| 지표 | 목표 |
|------|------|
| 좌석 점유 API P99 | ≤ 800ms |
| 좌석 점유 동시성 | 3,000 RPS 안정 |
| Kafka Consumer lag (피크) | < 5,000건, 60초 내 회복 |
| GC pause P99 | < 100ms (G1 → ZGC 비교 ADR) |
| 동일 좌석 중복 점유 | 0건 |

부하 시나리오는 `k6/seat-rush.js`에 정의, 로컬 Docker Compose의 k6 컨테이너로 실행.

---

## 5. FE 아키텍처 상세 (팀 내부 개발)

### 5.1 기술 스택 (확정)
- **언어**: TypeScript 5.x
- **빌드**: Vite 5
- **UI**: React 18 (Suspense + Concurrent)
- **데이터 페칭**: TanStack Query v5
- **상태 관리**: Zustand (UI/세션 상태)
- **실시간**: SSE 클라이언트 (`EventSource` 래퍼)
- **테스트**: Vitest + React Testing Library + Playwright (E2E 1건)

### 5.2 화면별 구현 포인트
| 화면 | 핵심 도전 | 담당 |
|------|----------|------|
| 대기열 진입 | 가상 대기열 순번 폴링/SSE, 진입 시점 전이 UX | 강민서 |
| 좌석 선택 | 좌석맵 캔버스, SSE로 실시간 점유 상태 반영, 낙관적 UI | 박지훈 (리더 직접 참여) |
| 주문/결제 | 5분 카운트다운, idempotency-key 클라이언트 측 보존 | 하진우 |
| 결제 결과 | PG 콜백 처리, 새로고침 안전성 | 강민서 |
| 관리자 모니터링 | Kafka lag/좌석 상태 대시보드 (Grafana 임베드) | 박지훈 |

### 5.3 BE-FE 인터페이스 계약
**source of truth: BE의 OpenAPI spec.** 다음 흐름으로 동기화한다.

1. BE 개발자가 controller에 `springdoc-openapi` 어노테이션 작성 → `/v3/api-docs` 자동 생성.
2. CI에서 `openapi.yaml`을 artifact로 추출, repo의 `contracts/openapi.yaml`로 커밋.
3. FE가 `openapi-typescript`로 TS 타입 자동 생성 (`pnpm gen:api`).
4. SSE 이벤트는 OpenAPI로 표현 어려우므로 `contracts/sse-events.md` + Zod 스키마 이중 운영.
5. spec 변경 시 BE PR에 FE 영향 라벨(`fe-contract-change`)을 의무 부착, FE 담당자 리뷰 필수.

**계약 변경 갈등은 G3 시나리오에서 다룬다.**

### 5.4 FE 학습 목표 (팀원별 차등)

> 박지훈 원칙: 정직한 자기 인식. 모두에게 동일한 목표를 부여하지 않는다.

| 팀원 | 현재 FE 수준(자기 신고/추정) | 이번 프로젝트 학습 목표 | 검증 산출물 |
|------|------------------------|-----------------------|------------|
| 박지훈 | TypeScript/React 입문 수준, 실무 경험 미미 | (1) Vite + React 프로젝트 구조 직접 구성, (2) SSE 클라이언트 직접 구현, (3) FE 측 ADR 1건 작성 | 좌석 선택 화면 + SSE 모듈 |
| 하진우 | React 기본 사용 가능, 상태 관리/캐싱 경험 부족 | (1) TanStack Query mutation/낙관적 업데이트 마스터, (2) 결제 흐름의 idempotency 클라이언트 패턴 정립 | 주문/결제 화면 + idempotency 가이드 |
| 강민서 | FE 미경험 (자기 신고: "HTML/CSS 정도") | (1) TypeScript 기본 → 컴포넌트 작성, (2) TanStack Query 기초, (3) Vitest 단위 테스트 1건 | 대기열/결제 결과 화면 + 테스트 코드 |

> 강민서의 FE 미경험은 리스크다. 1주 차에 박지훈이 90분 페어 프로그래밍 2회를 의무 진행하고, 강민서의 첫 PR은 박지훈이 직접 리뷰한다.

---

## 6. 팀원별 작업 배분 (BE + FE 통합)

| 영역 | 박지훈 | 하진우 | 강민서 |
|------|--------|--------|--------|
| **BE 핵심** | Arrow-kt 파일럿(`:order-api`), 성능 튜닝 주도, ADR 작성 | Kafka 토픽/파티셔닝 설계, saga/outbox 구현, 시스템 설계 주도 | 좌석 도메인 + 대기열 단독 구현, 외부 PG 연동 PoC |
| **FE 핵심** | 좌석 선택(SSE), 관리자 모니터링 | 주문/결제 (idempotency) | 대기열 진입, 결제 결과 |
| **테스트** | k6 시나리오 작성, 통합 테스트 | Testcontainers 기반 Kafka 통합 | Kotest 단위 테스트(BE), Vitest(FE) |
| **문서** | ADR 2건, Context 템플릿 운영, FE 도입 가이드 | 시스템 설계서, Kafka ADR, 장애 대응 런북 | 외부 연동 PoC 보고서, 거래/좌석 도메인 가이드 |
| **리뷰** | 전체 PR 감수 (특히 FE 첫 주) | 아키텍처 리뷰 주도 | 코드 리뷰 분기 20건 목표 분담 |

---

## 7. 8주 스프린트 구조

### 7.1 일정 유지 가능성 — 정직한 답변

**결론: 8주 유지하되 스코프를 다음과 같이 조정한다.**

| 항목 | v1.0 (FE 외부 위임 가정) | v2.0 (FE 내재화) |
|------|-------------------------|-----------------|
| 화면 수 | 5개 풀 구현 | 5개 (단, 관리자 모니터링은 Grafana 임베드로 단순화) |
| E2E 테스트 | 3 시나리오 | 1 시나리오 (좌석 점유 → 결제 happy path) |
| 결제 PG 연동 | 실제 sandbox | Mock PG (로컬 환경 한정) |
| FE 디자인 | 디자이너 협업 | 팀 자체 (Tailwind preset, 디자인 작업 최소화) |

**대안(거부)**: 10주로 연장 → KPI 분기 OKR 사이클과 어긋남. 스코프 축소가 합리적.

### 7.2 8주 스프린트

| 주차 | 핵심 마일스톤 | 박지훈 | 하진우 | 강민서 |
|------|--------------|--------|--------|--------|
| W1 | 인프라 셋업 + Walking Skeleton | Docker Compose 정합성, FE 프로젝트 부트스트랩 | Kafka 토픽 초안 ADR | 좌석 도메인 모델 초안 |
| W2 | 좌석 점유 MVP | Arrow-kt 파일럿(`:order-api`), 좌석 선택 화면 골격 | outbox 패턴 구현 | 좌석 점유 API + 단위 테스트 |
| W3 | 대기열 + 이벤트 흐름 | Arrow-kt 공유 세션, FE-BE 계약 자동화 CI | saga orchestrator, 시스템 설계서 v1 | 대기열 BE + FE 화면 |
| W4 | 결제 흐름 통합 | 좌석 SSE 안정화 | 주문/결제 화면 (idempotency), payment saga | 외부 PG Mock 연동 PoC |
| W5 | 부하 테스트 1차 + 갈등 G1 처리 | k6 시나리오 작성, 첫 부하 결과 분석 | Consumer lag 분석 | 결제 결과 화면 |
| W6 | 성능 튜닝 + ADR | JVM/GC 튜닝 ADR 1건 | Kafka 파티셔닝 재조정 | JPA N+1 정리, FE 테스트 보강 |
| W7 | 장애 시나리오 + 런북 | 갈등 시나리오 G2/G3 회고 운영 | 장애 대응 런북, Grafana 대시보드 | 좌석 충돌 시나리오 테스트 |
| W8 | 최종 부하 + 발표 | 최종 부하 결과 + KPI 보고 | 시스템 설계서 v2 + 발표 | 회고/문서 정리 |

---

## 8. 의도적 갈등 시나리오 (G1~G4)

> 박지훈 원칙: 갈등은 숨기지 않고 테이블에 올려 데이터로 해소한다. 4건 모두 KPI 3(갈등 조율 프로세스)에 기여한다.

### G1 — 분산락 구현 방식 갈등 (W2~W3)
- **참여 인물**: 하진우 vs 강민서
- **트리거**: 좌석 점유 분산락을 (a) PostgreSQL `SELECT FOR UPDATE` (강민서 주장: 단순) vs (b) Redis Lua (하진우 주장: 성능) 중 어느 쪽으로 갈 것인가.
- **데이터/근거**: 박지훈이 W2 말 양 방식 모두 PoC 후 k6 1,000 RPS에서 P99 비교. 결과 데이터를 근거로 결정.
- **조율 프로세스**: ADR 템플릿(맥락/대안/결정/결과) 작성 → 양측이 trade-off 표 합의 → 결정. 의견을 **사람**이 아닌 **데이터**에 묶는다.

### G2 — Kafka 파티션 키 갈등 (W3~W5)
- **참여 인물**: 하진우 vs 박지훈
- **트리거**: `order.created` 파티션 키를 `userId`(하진우) vs `orderId`(박지훈) 중 무엇으로 할 것인가. 사용자 단위 순서 보장 vs 핫 파티션 위험의 충돌.
- **데이터/근거**: W4~W5 부하 테스트에서 두 키 전략의 lag 분포·핫 파티션 비율 측정.
- **조율 프로세스**: 박지훈이 의도적으로 본인 의견을 1차에 보류, 하진우가 데이터 기반으로 재제안하게 유도(위임 범위 확장 — KPI 4 연결). 최종 ADR은 하진우 명의로 작성.

### G3 — BE-FE 인터페이스 계약 갈등 (W4)
- **참여 인물**: 강민서(FE 담당) vs 하진우(BE 결제 담당)
- **트리거**: 결제 응답 스키마 변경(필드 추가)을 BE가 spec 갱신 없이 머지 → FE 빌드 깨짐.
- **데이터/근거**: CI에서 OpenAPI diff 자동 검출 + 라벨 누락 사실 확인.
- **조율 프로세스**: (1) `fe-contract-change` 라벨 의무화를 PR 템플릿에 추가, (2) `openapi.yaml` 변경 시 FE 담당자 리뷰 필수 자동 할당(CODEOWNERS), (3) 회고에서 강민서가 **FE 측 입장에서** 직접 발표. 강민서의 의사결정 범위를 "기술 선택" 단계로 한 칸 확장한다.

### G4 — 성능 튜닝 우선순위 갈등 (W6)
- **참여 인물**: 박지훈 vs 가상 PO(시뮬레이션)
- **트리거**: PO가 W6에 기능 추가 1건을 끼워넣자고 요청 vs 박지훈은 성능 튜닝 미완 상태에서 추가 기능 거부.
- **데이터/근거**: 현재 P99 800ms 미달, GC pause 150ms 등 측정 데이터.
- **조율 프로세스**: 박지훈이 기술 언어를 비즈니스 언어로 번역해 PO에 제시 — "P99 800ms = 결제 단계에서 사용자 0.8초 대기 = 이탈률 X%". 데이터 기반 협상으로 기능 추가는 W8 이후로 연기 합의. 본 회고를 "갈등 조율 프로세스 v1"로 문서화하여 팀 공유 (KPI 3 산출물).

> **갈등 조율 프로세스 v1 (산출물)**: ① 사실 분리(누가 → 무엇을) ② 데이터 수집 합의 ③ ADR 작성 ④ 결정 후 회고 ⑤ 패턴화. 분기 1회 운영 점검.

---

## 9. KPI 연결 항목

> **합의 사항 (2026-05-05)**: KPI 파일은 "가계부 앱"으로 명시되어 있으나 본 프로젝트는 TicketRush로 진행한다. 사용자와 (b) 도메인만 교체, KPI 본질 충족으로 합의했으며 HR Chief 갱신 요청은 생략한다. 트레이서빌리티 차원에서 본 섹션에 명시한다.

### 박지훈 KPI 매핑
| KPI | 본 프로젝트 기여 |
|-----|-----------------|
| KPI 1 (분기 OKR 80%) | 8주 스프린트 마일스톤 달성률로 측정 |
| KPI 2 (성능 튜닝 ADR 1건↑) | C6 JVM/GC 튜닝 ADR + C7 Kafka lag ADR (W6 산출) |
| KPI 3 (갈등 조율 프로세스) | G1~G4 운영 + 프로세스 v1 문서화 |
| KPI 4 (1:1 + 위임 확장) | G2에서 하진우 결정권 위임, G3에서 강민서 발표 위임 |
| KPI 5 (Context 표준) | W1부터 작업 맥락 템플릿 강제, W4/W8 토큰 사용량 측정·공유 |
| KPI 6 (아키텍처 ADR 2건↑) | 분산락 ADR(G1) + Kafka 파티셔닝 ADR(G2) |
| KPI 7 (Arrow-kt 파일럿 + 공유) | W2 `:order-api` 파일럿 → W3 공유 세션 → W4~ 확산 |

### 하진우 KPI 매핑
- KPI 1: Kafka 토픽/파티셔닝/saga 구현 주도 (G2 ADR)
- KPI 2: 시스템 설계서 v1/v2 (W3, W8)
- KPI 3: G2 결과를 박지훈과 페어로 진행 (성능 튜닝 페어 작업)
- KPI 5: 장애 대응 런북 + Grafana 대시보드 (W7)

### 강민서 KPI 매핑
- KPI 1: 핵심 기능 PR 8건↑ (좌석/대기열/결제 결과 + FE 4화면)
- KPI 2: 좌석 도메인 + 대기열 단독 구현
- KPI 5: 외부 PG Mock PoC + 재시도/Circuit Breaker (W4)
- 추가: FE 학습 — 미경험 영역의 첫 산출물 확보

---

## 10. 부록: 로컬 인프라 셋업 가이드

### 10.1 사전 요구
- Docker Desktop 4.x, JDK 21, Node 20, pnpm 9, k6 (옵션, Docker로도 실행)

### 10.2 디렉토리 구조 (예시)
```
/ticketrush
├── docker-compose.yml
├── settings.gradle.kts
├── core-domain/
├── seat-api/  order-api/  payment-api/  queue-api/  notification-api/
├── infra-kafka/  infra-redis/  infra-jpa/
├── event-contract/
├── contracts/
│   ├── openapi.yaml          # CI가 갱신
│   └── sse-events.md         # 수동 + Zod 스키마
├── web-fe/                   # Vite + React + TS
└── k6/
    └── seat-rush.js
```

### 10.3 docker-compose.yml 핵심 서비스
- `postgres:16` (5432)
- `redis:7-alpine` (6379)
- `kafka:3.7` KRaft 모드 (9092)
- `prometheus`, `grafana` (3000), `loki`
- `k6` (on-demand `docker compose run k6 run /scripts/seat-rush.js`)

### 10.4 기동 절차
1. `docker compose up -d`
2. `./gradlew :seat-api:bootRun :order-api:bootRun ...` (또는 IntelliJ run config)
3. `cd web-fe && pnpm install && pnpm dev`
4. 부하 테스트: `docker compose run --rm k6 run /scripts/seat-rush.js`

### 10.5 관측
- Grafana 대시보드 3종 사전 프로비저닝: (1) Kafka lag, (2) JVM/GC, (3) HTTP P99/RPS
- 로그는 Loki로 집계, Grafana 단일 화면에서 trace 확인

---

## 11. 다음 액션 (W0, 즉시)

1. 본 구상안 팀 공유(2026-05-06 30분 킥오프) — 작업 맥락 템플릿(목표/제약/참고파일/완료기준)으로 각자 W1 태스크 전달
2. 강민서에게 FE 미경험 사실 재확인 + 페어 일정 합의
3. `contracts/openapi.yaml` 자동 생성 CI 잡 W1 데이 1 완료 (G3 예방)
4. 하진우에게 G2 결정권 위임 사전 고지 (KPI 4 위임 범위 확장 시작)

— 박지훈 (feature-develop 팀 리더)
