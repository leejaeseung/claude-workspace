# ADR-004: JVM GC 전략 — G1GC → ZGC 전환

- **상태**: 확정 (Accepted)
- **작성일**: 2026-05-10
- **참여자**: feature-develop-leader, feature-develop-developer-2(하진우)
- **배경**: W5 성능 튜닝 스프린트

---

## 컨텍스트

k6 부하 테스트(3,000 RPS, 100개 좌석 경합 시나리오)를 실행한 결과 P99 레이턴시가 목표치(800ms)를 초과했다. 원인 분석을 통해 JVM G1GC의 STW(Stop-The-World) pause가 주된 요인으로 파악됐다.

### 측정 결과 (G1GC 기준)

| 지표 | 측정값 | 목표 |
|------|--------|------|
| seat-api HTTP P99 | 1,240ms | < 800ms ❌ |
| G1GC STW pause (p99) | 180ms | < 10ms ❌ |
| Kafka consumer lag (peak) | 8,500 | < 5,000 ⚠️ |
| JVM Heap 사용률 | 78% | < 85% ✅ |

GC pause가 200ms 근방에서 발생할 때 HTTP P99가 급등하는 correlation이 Grafana 대시보드에서 명확히 관찰됐다.

---

## 결정: ZGC 전환

### 전환 근거

| 항목 | G1GC | ZGC |
|------|------|-----|
| STW pause 최대 | ~200ms (힙 크기 비례) | < 1ms (힙 크기와 무관) |
| 처리량 오버헤드 | 낮음 | 5~10% (동시 GC 비용) |
| 최적화 목표 | Throughput | Low Latency |
| JDK 버전 요구 | JDK 8+ | JDK 15+ (Production-ready) |
| 적합 서비스 유형 | 배치, 데이터 파이프라인 | 실시간 API 서버 |

TicketRush의 핵심 제약은 **P99 < 800ms**이다. 처리량 5~10% 손실은 하드웨어 스케일 아웃으로 보완 가능하지만, GC pause로 인한 레이턴시 급등은 사용자 경험에 직접 영향을 미친다.

### ZGC 설정

```bash
# WebFlux 서비스 (seat-api, queue-api, notification-api)
-XX:+UseZGC
-XX:ZCollectionInterval=5      # 5초마다 GC 사이클 (기본값: 0 = adaptive)
-XX:ZUncommitDelay=300         # 미사용 힙을 OS에 반환하는 지연 (5분)
-XX:+ZProactive                # 미래 할당 예측 기반 선제적 GC
-Xms256m -Xmx768m

# MVC 서비스 (order-api, payment-api)
-XX:+UseZGC
-XX:ZCollectionInterval=5
-XX:ZUncommitDelay=300
-XX:+ZProactive
-Xms512m -Xmx1536m
```

### ZCollectionInterval 선택 근거

ZGC는 기본적으로 adaptive하지만, 콘서트 오픈 직후 트래픽이 폭발적으로 증가할 때 GC가 늦게 반응하면 힙이 순간적으로 가득 차 STW fallback이 발생한다. `ZCollectionInterval=5`로 주기적 GC를 강제하여 힙 여유를 항상 유지한다.

---

## 전환 후 측정 결과

| 지표 | G1GC | ZGC | 개선율 |
|------|------|-----|--------|
| seat-api HTTP P99 | 1,240ms | 430ms | **65% 감소** ✅ |
| GC STW pause p99 | 180ms | 0.8ms | **99.6% 감소** ✅ |
| Kafka consumer lag (peak) | 8,500 | 3,200 | **62% 감소** ✅ |
| JVM 처리량 | 100% | ~93% | 7% 감소 (허용 범위) |

P99 목표 800ms 달성 확인.

---

## 남은 최적화 항목

1. **Kafka 컨슈머 랙**: `max.poll.records=500 → 200` 낮추기 (처리 지연 분산)
2. **Connection Pool**: HikariCP `maximum-pool-size=10 → 20` (order/payment MVC 서비스)
3. **WebFlux 스케줄러**: `Schedulers.parallel()` 스레드 수 = CPU core × 2 검토

---

## 교훈

JVM 튜닝은 "측정 → 가설 → 검증" 루프를 반드시 따라야 한다. ZGC가 무조건 좋은 것이 아니라, **레이턴시 민감 + 힙이 2GB 이하 + JDK 21+** 환경에서 효과가 극대화된다. 힙이 8GB 이상인 배치 서비스는 G1GC 유지가 더 유리할 수 있다.
