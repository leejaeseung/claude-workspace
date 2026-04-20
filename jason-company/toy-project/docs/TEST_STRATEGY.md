# 테스트 전략 문서

**작성자**: 최아린 (테스트 엔지니어링 전문가)  
**작성일**: 2026-04-19  
**연계**: 이준혁 리팩토링 Phase 0 (ARB 합의)

---

## 1. 리스크 기반 3문항 분석

```
[최아린의 리스크 기반 3문항 적용 결과]

Q1. 이 코드가 실패하면 얼마나 아픈가?
→ 주문 처리 + 결제 + 재고 차감 — 금전적 영향 직접 연관 (HIGH)

Q2. 이 케이스가 실제로 발생할 가능성은?
→ 핵심 비즈니스 플로우 — 매 주문마다 실행 (VERY HIGH)

Q3. 팀 전체가 이 테스트의 필요성을 이해하는가?
→ ARB 합의로 필요성 인정됨 (YES)

결론: 최우선 테스트 대상. Golden Master 필수.
```

---

## 2. 테스트 피라미드 계획

```
         [E2E — 미적용, 토이 프로젝트 범위 외]
        ──────────────────────────────────────
       [통합 테스트 — 추후 TestContainers로]
      ──────────────────────────────────────────
    [유닛 테스트 — Phase 3에서 각 모듈별 작성]
   ────────────────────────────────────────────────
  [Golden Master Test — Phase 0, 지금 바로 구축!]
 ──────────────────────────────────────────────────────
```

---

## 3. Golden Master 테스트 설계

### 목적
레거시 `LegacyOrderService`의 현재 동작을 "사진 찍듯" 고정.  
이준혁이 리팩토링해도 동일한 입력 → 동일한 출력을 보장.

### Flaky Test 위험 요소 및 대응

| 위험 요인 | 위험도 | 대응 방법 |
|----------|--------|-----------|
| `UUID.randomUUID()` 비결정성 | 🔴 HIGH | orderId 대신 success/status 검증 |
| `LocalDateTime.now()` 시간 의존성 | 🔴 HIGH | createdAt 필드 검증 제외 |
| 전역 재고 상태 공유 | 🟡 MEDIUM | 각 테스트 전 재고 초기화 (@BeforeEach) |

### 커버리지 목표 (ARB 합의)
- 핵심 플로우 (정상 주문): **100%**
- 실패 케이스 (재고 부족, 잘못된 쿠폰 등): **100%**
- 전체 메서드 커버리지 목표: **85%**

---

## 4. 테스트 케이스 목록

| TC | 시나리오 | 예상 결과 |
|----|---------|----------|
| TC-01 | 카드 결제 정상 주문 (쿠폰 없음) | success=true, status=SHIPPING |
| TC-02 | 카카오페이 + WELCOME10 쿠폰 | success=true, 10% 할인 적용 |
| TC-03 | 재고 부족 케이스 | success=false, 재고 부족 에러 |
| TC-04 | 잘못된 쿠폰 코드 | success=false, 쿠폰 에러 |
| TC-05 | 가상계좌 — 배송 시작 안 됨 | success=true, status=PAID |
| TC-06 | 주문 취소 (PAID 상태) | success=true, status=CANCELLED |
| TC-07 | 배송 중 취소 시도 | success=false, 취소 불가 에러 |

---

## 5. 유닛 테스트 설계 (Phase 3 계획)

리팩토링 완료 후 작성할 유닛 테스트:

### PaymentStrategy 테스트
```
- CardPaymentStrategy: 정상 결제, 한도 초과 실패
- KakaoPayStrategy: VIP/일반 한도 차이 검증
- NaverPayStrategy: 50만원 한도 검증
- VirtualAccountStrategy: 항상 성공
```

### OrderStateMachine 테스트
```
- PENDING → PAID 전이
- PAID → SHIPPING 전이
- PAID → CANCELLED 전이
- SHIPPING → CANCELLED 불가 (예외 발생)
- 잘못된 상태 전이 시 IllegalStateException
```

### OrderEventPublisher 테스트
```
- 구독자 등록 후 이벤트 발행 시 호출 여부
- 구독자 없을 때 이벤트 발행 시 오류 없음
- 이메일/SMS/푸시 각 구독자 독립 검증
```

---

## 최아린 코멘트

> "Golden Master 테스트는 리팩토링 전에 먼저 완성되어야 합니다.  
> Flaky하면 안전망이 아닙니다. 비결정적 요소(UUID, 시간)를 반드시 제거하고,  
> 각 테스트가 완전히 독립적으로 실행되도록 @BeforeEach 초기화를 철저히 합니다.  
> '충분함의 기준'은 팀 ARB에서 정했으니 그 이상을 요구하지 않겠습니다. 85%면 충분합니다."
