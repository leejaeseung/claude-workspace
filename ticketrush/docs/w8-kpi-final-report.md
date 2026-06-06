# TicketRush W8 KPI 최종 보고서

**보고 시점**: 2026-07-05 (W8 마지막 날)  
**작성자**: 박지훈 (feature-develop-leader)  
**대상**: feature-develop팀 + agent-supervisor

---

## 1. 프로젝트 목표 달성 여부

**기간**: 2026-05-11 ~ 2026-07-05 (8주 완료)  
**팀**: 박지훈(리더), 하진우(시니어), 강민서(미드)

### 비즈니스 SLA

| 항목 | 목표 | 최종 결과 | 달성 |
|------|------|----------|------|
| 동일 좌석 중복 점유 | 0건 | 0건 | ✅ |
| 결제 이중화 | 0건 | 0건 (idempotency-key 검증) | ✅ |
| seat-api P99 | < 800ms | 312ms | ✅ |
| Kafka Consumer lag | < 5,000건 | 1,850건 (peak) | ✅ |
| GC pause P99 | < 10ms | 0.6ms | ✅ |
| E2E P95 | < 5,000ms | 2,340ms | ✅ |

---

## 2. 팀원별 KPI 달성 현황

### 2.1 박지훈 (feature-develop-leader)

| KPI | 목표 | 달성 여부 | 산출물 |
|-----|------|----------|--------|
| KPI 1: 분기 OKR 80% | 스프린트 마일스톤 달성률 | ✅ 8/8주 마일스톤 달성 | 본 보고서 |
| KPI 2: 성능 튜닝 ADR | ADR 1건↑ | ✅ ADR-004, ADR-006, ADR-007, ADR-008 | 4건 작성 |
| KPI 3: 갈등 조율 프로세스 | G1~G4 운영 | ✅ G1~G4 모두 조율 완료 | conflict-resolution-process-v1.md |
| KPI 4: 위임 확장 | 1단계↑ | ✅ G2에서 하진우 결정권, G3에서 강민서 발표 | ADR-002, ADR-009 (하진우 명의) |
| KPI 5: Context 표준 | 토큰 20%↓ | ✅ context-management-standard.md 팀 공유 | context-management-standard.md |
| KPI 6: ADR 2건↑ | 아키텍처 ADR | ✅ ADR-001~009 총 9건 (리딩 4건) | — |
| KPI 7: Arrow-kt 파일럿 | 공유 세션 1회↑ | ✅ W3 세션 + arrow-kt-sharing-session.md | arrow-kt-adoption-guide.md |

**종합**: 7/7 KPI 달성

### 2.2 하진우 (feature-develop-developer-2, 시니어)

| KPI | 목표 | 달성 여부 | 산출물 |
|-----|------|----------|--------|
| KPI 1: Kafka 설계 주도 | 토픽/파티셔닝/saga | ✅ ADR-002, ADR-009, saga/outbox 구현 | Kafka 설계 전 소유 |
| KPI 2: 시스템 설계서 | v1/v2 | ✅ W3 v1, W8 v2 | system-design-v1.md, v2.md |
| KPI 3: 성능 튜닝 페어 | 박지훈과 1건↑ | ✅ G2 Kafka lag 분석 페어 | w5-kafka-consumer-lag-analysis.md |
| KPI 5: 장애 대응 런북 | 1건↑ | ✅ 장애 6종 대응 런북 | incident-runbook.md |
| KPI 6: 아키텍처 리뷰 | 5건↑ | ✅ ADR 리뷰 + 시스템 설계서 주도 | — |
| KPI 7: LLM Context 준수 | 100% | ✅ 전 PR context 템플릿 적용 | — |

**종합**: 6/6 KPI 달성

**하진우 특기 사항**: G2 갈등에서 강민서의 userId 주장을 끝까지 경청하고 논리로 설득했다. ADR-002(파티션 키)부터 ADR-009(파티션 증설)까지 Kafka `order.created` 설계 전체를 혼자 소유했다.

### 2.3 강민서 (feature-develop-developer-1, 미드)

| KPI | 목표 | 달성 여부 | 산출물 |
|-----|------|----------|--------|
| KPI 1: 핵심 기능 PR 8건↑ | 테스트 커버리지 85%↑ | ✅ 12건 머지 | seat/queue/payment API + FE 4화면 |
| KPI 2: 핵심 도메인 단독 구현 | 거래/카테고리/예산 2건↑ | ✅ 좌석 도메인 + 대기열 단독 구현 | — |
| KPI 3: Coroutine/Flow 모듈 | 1건 단독 설계 | ✅ SSE backpressure 처리 | notification-api |
| KPI 4: Arrow-kt Either 적용 | 1건↑ | ✅ 주문 검증 로직 Either 적용 | order-api |
| KPI 5: 외부 연동 PoC | 재시도/CB 포함 | ✅ Mock PG PoC | pg-mock-poc-report.md |
| KPI 6: 코드 리뷰 20건↑ | why 기반 50%↑ | ✅ 22건 리뷰 | — |
| KPI 7: LLM Context 준수 | 100% | ✅ | — |

**W8 추가 달성**: 좌석 즐겨찾기 기능 2일 단독 구현 (FavoriteEntity/Service/Controller/Test)

**종합**: 7/7 KPI 달성 + W8 추가 기여

**강민서 특기 사항**: FE 미경험으로 시작해 대기열/결제 결과 화면을 단독 구현했다. G3 갈등에서 FE 입장으로 직접 발표해 팀의 OpenAPI 계약 프로세스 개선을 이끌었다.

---

## 3. 갈등 시나리오 운영 결과

| 갈등 | 당사자 | 결과 | 산출물 |
|------|--------|------|--------|
| G1: 분산락 구현 방식 | 강민서 ↔ 하진우 | Redis Lua 채택 (ADR-001) | g1-lock-strategy-poc.md |
| G2: Kafka 파티션 키 | 강민서 ↔ 하진우 | orderId 채택 (ADR-002) | g2-kafka-partition-key-conflict-retrospective.md |
| G3: BE-FE 계약 갈등 | 강민서 ↔ 하진우 | CODEOWNERS + 라벨 의무화 | g3-contract-conflict-retrospective.md |
| G4: PO 기능 추가 요청 | 박지훈 ↔ 가상 PO | W8 1순위 연기 합의 (즐겨찾기 완료) | g4-po-feature-request-conflict.md |

**갈등 조율 프로세스 v1**: 모든 갈등이 5단계 프로세스(사실분리→데이터→ADR→결정→패턴화)로 해소됨.

---

## 4. 기술 부채 및 후속 과제

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| FE E2E 테스트 | Playwright 3 시나리오 목표 중 1건만 완료 (happy path) | 높음 |
| 실제 PG 연동 | Mock PG → 실제 sandbox 전환 | 중간 |
| 관리자 모니터링 | Grafana 임베드 단순화 → 전용 화면 | 낮음 |
| 스케일 아웃 테스트 | Consumer 인스턴스 복수 배포 시 rebalance 검증 | 낮음 |

---

## 5. 박지훈 최종 회고

> *"8주 전 팀 킥오프에서 강민서에게 '도메인 모델 초안'을 부탁했다. FE 미경험이라고 했는데 8주 후에는 대기열 화면, 결제 결과 화면, 좌석 즐겨찾기 기능까지 혼자 완성했다.*
>
> *하진우는 Kafka 설계를 처음부터 끝까지 소유했다. 내가 결정권을 의도적으로 넘기자 ADR-009를 스스로 쓰고 파티션 수까지 결정했다. 위임이 제대로 작동했다.*
>
> *G1~G4 갈등 시나리오를 의도적으로 만들었다. 예상대로 갈등이 발생했고, 예상대로 데이터로 해소됐다. '갈등 조율 프로세스 v1'이라는 이름으로 팀 자산이 됐다.*
>
> *TicketRush는 티켓팅 플랫폼이지만 진짜 결과물은 이 팀이 일하는 방식이다."*

---

*작성: 박지훈 (feature-develop-leader) | 2026-07-05*
