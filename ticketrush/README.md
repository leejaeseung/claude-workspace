# TicketRush

실시간 티켓팅 플랫폼 — 고부하 분산 시스템 학습 프로젝트

## 기술 스택

- **BE**: Kotlin 2.0, Spring Boot 3.4, Kafka 3.7, Redis 7, PostgreSQL 16, Arrow-kt 1.2
- **FE**: React 18, TypeScript 5, Vite 5, TanStack Query v5

## 모듈 구조

| 모듈 | 포트 | 역할 | 기술 |
|------|------|------|------|
| queue-api | 8081 | 가상 대기열 | WebFlux |
| seat-api | 8082 | 좌석 점유·분산락 | WebFlux |
| order-api | 8083 | 주문 생성·관리 | MVC |
| payment-api | 8084 | 결제 처리·Saga | MVC |
| notification-api | 8085 | SSE 실시간 알림 | WebFlux |
| core-domain | - | 도메인 모델 | - |
| event-contract | - | Kafka 이벤트 스키마 | - |
| infra-kafka | - | Kafka 설정 | - |
| infra-redis | - | Redis 설정 | - |
| infra-jpa | - | JPA·Flyway 설정 | - |

## 기동 방법

```bash
# 1. 인프라 기동
docker compose up -d

# 2. 각 서비스 실행
./gradlew :queue-api:bootRun
./gradlew :seat-api:bootRun
./gradlew :order-api:bootRun
./gradlew :payment-api:bootRun
./gradlew :notification-api:bootRun

# 3. FE
cd web-fe && pnpm install && pnpm dev

# 4. 부하 테스트
docker compose run --rm k6 run /scripts/seat-rush.js
```

## 헬스 체크

```bash
curl http://localhost:8081/health  # queue-api
curl http://localhost:8082/health  # seat-api
curl http://localhost:8083/health  # order-api
curl http://localhost:8084/health  # payment-api
curl http://localhost:8085/health  # notification-api
```

## 모니터링

- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
