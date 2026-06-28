# OpenAPI 계약 관리 가이드

**작성자**: 박지훈 (feature-develop 팀 리더)  
**날짜**: 2026-05-30  
**버전**: v1.0 (W3 — springdoc 도입)

> springdoc-openapi-starter 2.6.0 사용 (Spring Boot 3.4.x 호환 — 2.5.0은 3.4.x와 호환성 검증 미완료)

---

## 1. 계약 소유권

**BE가 source of truth**다. FE는 BE가 생성한 spec을 소비한다.

```
BE 컨트롤러 어노테이션
    └─▶ springdoc 자동 생성
            └─▶ /v3/api-docs (런타임)
                    └─▶ contracts/openapi-{service}.yaml (CI 추출)
                            └─▶ FE: openapi-typescript로 타입 자동 생성
```

---

## 2. 각 서비스 API 문서 URL

서비스 실행 후 접근 가능:

| 서비스 | Swagger UI | API Docs (YAML) |
|--------|-----------|-----------------|
| queue-api | http://localhost:8081/swagger-ui.html | http://localhost:8081/v3/api-docs |
| seat-api | http://localhost:8082/swagger-ui.html | http://localhost:8082/v3/api-docs |
| order-api | http://localhost:8083/swagger-ui.html | http://localhost:8083/v3/api-docs |
| payment-api | http://localhost:8084/swagger-ui.html | http://localhost:8084/v3/api-docs |
| notification-api | http://localhost:8085/swagger-ui.html | http://localhost:8085/v3/api-docs |

---

## 3. FE 타입 생성 방법

### 설치
```bash
cd web-fe
pnpm add -D openapi-typescript
```

### 타입 생성 (서비스별)
```bash
# 각 서비스 실행 중인 상태에서
pnpm dlx openapi-typescript http://localhost:8081/v3/api-docs -o src/types/queue-api.d.ts
pnpm dlx openapi-typescript http://localhost:8082/v3/api-docs -o src/types/seat-api.d.ts
pnpm dlx openapi-typescript http://localhost:8083/v3/api-docs -o src/types/order-api.d.ts
pnpm dlx openapi-typescript http://localhost:8084/v3/api-docs -o src/types/payment-api.d.ts
```

### package.json scripts 추가 권장
```json
{
  "scripts": {
    "gen:api": "pnpm gen:queue && pnpm gen:seat && pnpm gen:order && pnpm gen:payment",
    "gen:queue": "openapi-typescript http://localhost:8081/v3/api-docs -o src/types/queue-api.d.ts",
    "gen:seat": "openapi-typescript http://localhost:8082/v3/api-docs -o src/types/seat-api.d.ts",
    "gen:order": "openapi-typescript http://localhost:8083/v3/api-docs -o src/types/order-api.d.ts",
    "gen:payment": "openapi-typescript http://localhost:8084/v3/api-docs -o src/types/payment-api.d.ts"
  }
}
```

---

## 4. 계약 변경 시 프로세스

1. **BE 개발자**: 컨트롤러 변경 후 PR에 `fe-contract-change` 라벨 부착 (의무)
2. **PR 리뷰어**: 라벨 확인, FE 담당자에게 알림
3. **FE 담당자**: 서비스 재기동 후 `pnpm gen:api` 실행, 타입 오류 수정
4. **ADR-003** 참고: [ADR-003-openapi-contract-ownership.md](adr/ADR-003-openapi-contract-ownership.md)

---

## 5. SSE 이벤트 계약

SSE 이벤트는 OpenAPI로 표현하기 어렵다. `contracts/sse-events.md`에 별도 관리한다.

현재 SSE 이벤트:
- `queue.position.updated`: 대기 순번 갱신 (`/sse/queue/{userId}`)
- `seat.changed`: 좌석 상태 변경 (`/sse/seat/{showId}`)

---

## 6. 현재 contracts/ 폴더 상태

- `contracts/openapi.yaml`: 수동 작성된 초기 스펙 (springdoc 도입 전 레거시)
  → springdoc 도입 완료 후 자동 생성 spec으로 대체 예정 (W4)
- `contracts/sse-events.md`: SSE 이벤트 스키마 (수동 관리 유지)
