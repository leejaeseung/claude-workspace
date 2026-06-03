# ADR-009: order.created 토픽 파티션 증설 (6 → 12)

- **상태**: Accepted
- **작성일**: 2026-06-16 (W6)
- **작성자**: 하진우 (feature-develop-developer-2)
- **리뷰**: 박지훈 (feature-develop-leader)
- **위임 사례**: 박지훈이 결정권을 하진우에게 위임 (KPI 4 — G2 위임 확장의 연속)

---

## 컨텍스트

W5 부하 테스트에서 `seat-api-order` Consumer Group의 `order.created` 토픽 처리에서 피크 lag 7,200건이 관찰됐다 (목표: < 5,000건).

### 원인 분석 요약 (w5-kafka-consumer-lag-analysis.md)

1. **max.poll.records=500** → 배치 처리 과부하 → W6에서 100으로 조정 완료
2. **HikariCP 포화** → pool 10→20 조정 완료
3. **파티션 부족** → `order.created` 6파티션, Consumer 1인스턴스 → 병렬 처리 불가

`max.poll.records` 조정 후 재측정 결과 (2026-06-16):

| 지표 | 조치 전 | 조치 후 | 목표 |
|------|---------|---------|------|
| 피크 lag | 7,200건 | **2,800건** | < 5,000건 ✅ |
| 회복 시간 | 95초 | **28초** | < 60초 ✅ |

lag은 목표 달성했다. 그러나 3,000 RPS 지속 시나리오에서 파티션 부족이 향후 확장성 한계로 작용할 수 있다. W6에서 선제적으로 증설한다.

---

## 결정 옵션

### Option A: 현행 유지 (6 파티션)

- 현재 max.poll.records 조정으로 목표 달성 → 즉각 변경 필요 없음
- 단, Consumer 인스턴스 수평 확장 시 파티션이 최대 병렬 처리 단위가 됨
- 6 인스턴스 이상으로는 확장 불가

### Option B: 12 파티션으로 증설 ✅ (채택)

- `seat.changed`와 파티션 수 통일 → Grafana 대시보드 모니터링 일관성
- 향후 Consumer 인스턴스 6개까지 확장 가능 (로컬 환경 한계: 1개)
- 파티션 증설은 **무중단** (기존 메시지 보존, 신규 파티션은 새 메시지만 수신)

**주의**: 파티션 증설은 되돌릴 수 없다. 감소는 토픽 재생성이 필요하다.

---

## 결정 근거

1. **향후 확장성**: 3,000 RPS 지속 구간에서 seat-api 인스턴스를 2~3개 추가할 경우 파티션이 병목이 될 수 있다.
2. **모니터링 일관성**: `seat.changed`(12파티션)와 `order.created`(6파티션)이 섞이면 Grafana Consumer lag 대시보드 해석이 복잡해진다.
3. **무중단 적용 가능**: 파티션 증설은 서비스 재시작 없이 적용 가능.
4. **비용 無**: 로컬 Docker KRaft 환경에서 파티션 수 증설은 추가 자원 불필요.

---

## 구현

```kotlin
// infra-kafka/KafkaTopicConfig.kt
@Bean fun orderCreatedTopic(): NewTopic =
    TopicBuilder.name(TopicNames.ORDER_CREATED).partitions(12).replicas(1).build()
```

**롤아웃 절차**:
1. `KafkaTopicConfig` 변경 → 애플리케이션 재시작
2. Spring Kafka는 기존 토픽에 새 파티션을 자동 추가 (NewTopic은 idempotent)
3. Grafana에서 파티션별 lag 분포 확인 (균등 분산 기대)

---

## 파급 효과

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| `order.created` 파티션 수 | 6 | 12 |
| 최대 Consumer 병렬 수 | 6 | 12 |
| 파티션 키 (`orderId`) | 변경 없음 | 변경 없음 |
| Grafana Consumer lag 모니터링 | lag 표현 파티션 6개 | 12개 균등 분산 |

**기존 Consumer Group** (`seat-api-order`): 자동으로 새 파티션을 할당받음. 기존 Consumer 1인스턴스가 12파티션을 모두 소비하는 것은 동일하나, 확장 시 파티션당 1 Consumer가 보장된다.

**ADR-002 파티션 키 결정 (`orderId`)**: 변경 없음. 파티션 수 변경으로 기존 파티션의 메시지 분포가 변하지만, orderId 기반 해시 분산은 균등하게 유지된다.

---

## 연관 ADR

- ADR-002: `order.created` 파티션 키 (`orderId`) 결정
- ADR-006: W6 성능 튜닝 (max.poll.records, HikariCP 조정)
- ADR-007: E2E 부하 테스트 전략

---

## 하진우 자가 평가

> *"이번 파티션 증설은 현재 lag이 목표치를 달성한 상황에서 선제적 결정이다. 박지훈이 '데이터로 결정하되 방향은 네가 설정해'라고 했고, lag 재측정 결과와 확장성 요구사항을 근거로 스스로 판단했다.*
>
> *G2에서 파티션 키를 orderId로 정한 ADR도 내가 썼고, 이번 파티션 증설 ADR도 내가 쓴다. 파티션 설계의 처음부터 끝을 내가 소유하는 것이 된다."*

*본 ADR은 박지훈 KPI 4 "의사결정 위임 범위 확장" 및 하진우 KPI 1 "Kafka 기반 이벤트 아키텍처 설계 주도"의 사례이다.*
