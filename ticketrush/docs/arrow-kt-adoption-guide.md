# Arrow-kt TicketRush 도입 가이드

**작성자**: 박지훈 (feature-develop 팀 리더)  
**작성일**: 2026-06-11 (W5)  
**대상**: 팀 전원 (특히 강민서, 하진우)  
**선수 자료**: `docs/arrow-kt-sharing-session.md` (W3 공유 세션)  
**KPI 연결**: 박지훈 KPI 7 — Arrow-kt 파일럿 후 팀 공유 세션 + 도입 가이드 작성

---

## 1. 현재 적용 현황

W2 파일럿(`:order-api`)을 시작으로 현재 다음 모듈에 Either가 도입되어 있다.

| 모듈 | 적용 함수 | Either 타입 |
|------|---------|------------|
| `order-api` | `OrderService.createOrder()` | `Either<DomainError, Order>` |
| `order-api` | `OrderService.getOrder()` | `Either<DomainError, Order>` |
| `payment-api` | `PaymentService.processPayment()` | `Either<DomainError, Payment>` |
| `seat-api` | `SeatLockService.acquire()` | `Mono<Either<DomainError, SeatLock>>` |
| `seat-api` | `SeatLockService.acquireWithDbLock()` | `Mono<Either<DomainError, SeatLock>>` |

---

## 2. 표준 패턴 (동기 코드)

### 2.1 서비스 계층

```kotlin
// OrderService.kt 참고 구현
@Transactional
fun createOrder(userId: String, seatId: Long, showId: Long): Either<DomainError, Order> =
    either {
        // raise()로 실패 즉시 반환 — 이후 코드는 실행되지 않음
        validateUserId(userId).bind()
        validateSeatId(seatId).bind()

        val saved = orderRepository.save(OrderEntity(...))
        Order(id = saved.id, ...)
    }

// 검증 헬퍼: Either 반환
private fun validateUserId(userId: String): Either<DomainError, Unit> =
    if (userId.isNotBlank()) Unit.right()
    else DomainError.UnauthorizedAccess(userId).left()
```

**핵심 규칙**:
1. `either { }` 블록 안에서 실패는 `raise()` 또는 `.bind()`로 전파
2. `throw`는 절대 사용하지 않는다 — 타입 시스템이 실패를 추적하지 못하게 됨
3. 검증 헬퍼 함수는 `Either<DomainError, Unit>` 반환

### 2.2 컨트롤러 계층

```kotlin
// SeatController.kt, OrderController.kt 참고 구현
@PostMapping
fun create(@RequestBody request: CreateOrderRequest): ResponseEntity<Any> =
    when (val result = orderService.createOrder(request.userId, request.seatId, request.showId)) {
        is Either.Right -> ResponseEntity.status(HttpStatus.CREATED).body(result.value.toResponse())
        is Either.Left  -> ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(
            ErrorResponse("order-creation-failed", result.value.message)
        )
    }
```

**패턴**: `when (val result = service.method()) { is Either.Right → ... is Either.Left → ... }`

---

## 3. 반응형(Reactive) 코드 패턴

WebFlux + Arrow-kt를 함께 쓸 때는 `Mono<Either<DomainError, T>>`를 사용한다.

```kotlin
// SeatLockService.kt 참고 구현
fun acquire(showId: Long, seatId: Long, userId: String): Mono<Either<DomainError, SeatLock>> =
    redisTemplate.execute(ACQUIRE_SCRIPT, listOf(key), listOf(userId, ttlSeconds))
        .next()
        .map { result ->
            if (result == 1L) SeatLock(...).right()
            else DomainError.SeatAlreadyLocked(seatId).left()
        }
        .defaultIfEmpty(DomainError.SeatAlreadyLocked(seatId).left())
```

**컨트롤러에서 사용**:

```kotlin
// SeatController.lock() 참고
fun lock(...): Mono<ResponseEntity<Any>> =
    seatLockService.acquire(request.showId, seatId, request.userId)
        .map { result ->
            when (result) {
                is Either.Right -> ResponseEntity.ok<Any>(LockResponse(...))
                is Either.Left  -> ResponseEntity.status(HttpStatus.CONFLICT).body<Any>(ErrorResponse(...))
            }
        }
```

---

## 4. QueueService 적용 예시 (강민서 참고)

현재 `QueueService`는 `Mono<QueueEntry>` 방식이다. 에러 케이스(userId 비어있음 등)를 Either로 표현하면:

```kotlin
// 현재 방식 (변경 전)
fun enter(userId: String, showId: Long): Mono<QueueEntry> { ... }

// Arrow-kt 적용 (변경 후)
fun enter(userId: String, showId: Long): Mono<Either<DomainError, QueueEntry>> {
    if (userId.isBlank()) return Mono.just(DomainError.UnauthorizedAccess(userId).left())

    val key = RedisKeyspace.queue(showId)
    val score = System.currentTimeMillis().toDouble()

    return redisTemplate.opsForZSet()
        .addIfAbsent(key, userId, score)
        .flatMap { redisTemplate.opsForZSet().rank(key, userId) }
        .flatMap { rank ->
            val position = (rank ?: 0L) + 1
            val waitSeconds = position / ENTRY_RATE_PER_SECOND
            queuePositionPublisher.publish(showId, userId, position, waitSeconds)
                .thenReturn(QueueEntry(userId, showId, position, waitSeconds).right())
        }
}
```

> **강민서에게**: 위 패턴은 W6 작업 기회가 생기면 적용해보자. 지금 당장 바꾸지 않아도 된다.

---

## 5. DomainError 확장 방법

새로운 에러 케이스가 생기면 `core-domain/DomainError.kt`에 추가한다.

```kotlin
// 현재 정의
sealed class DomainError(val message: String) {
    data class SeatAlreadyLocked(val seatId: Long) : DomainError(...)
    data class OrderNotFound(val orderId: Long)    : DomainError(...)
    data class PaymentAlreadyProcessed(val idempotencyKey: String) : DomainError(...)
    data class PgUnavailable(val reason: String)   : DomainError(...)
    // ...
}

// 추가 예시 (대기열 에러)
data class QueueFull(val showId: Long) : DomainError("Queue is full for show $showId")
data class TokenExpired(val userId: String) : DomainError("Entry token expired for $userId")
```

**원칙**: `sealed class`를 사용하므로 `when` 식에서 모든 케이스를 강제 처리. 새 에러를 추가하면 컴파일러가 누락된 `when` 분기를 알려준다.

---

## 6. 테스트에서의 사용

```kotlin
// OrderServiceTest.kt 참고
it("유효한 입력 — Right(Order)를 반환한다") {
    val result = service.createOrder("user-1", 42L, 100L)

    result.isRight() shouldBe true
    result.getOrNull()!!.userId shouldBe "user-1"
}

it("userId가 공백 — Left(UnauthorizedAccess)를 반환한다") {
    val result = service.createOrder("", 42L, 100L)

    result.isLeft() shouldBe true
    result.leftOrNull().shouldBeInstanceOf<DomainError.UnauthorizedAccess>()
}
```

**유용한 Arrow 확장 함수**:
- `result.isRight()` / `result.isLeft()` → Boolean
- `result.getOrNull()` → T? (Right이면 값, Left이면 null)
- `result.leftOrNull()` → E? (Left이면 에러, Right이면 null)
- `result.getOrElse { defaultValue }` → T

---

## 7. 팀 규칙 요약

| 상황 | 선택 | 이유 |
|------|------|------|
| 예측 가능한 비즈니스 실패 | `Either<DomainError, T>` | 타입에 실패 가능성 명시 |
| 예측 불가능한 인프라 오류 | `exception` 허용 | DB 연결 끊김 등은 Either로 표현 불필요 |
| 여러 검증 오류 누적 | `Validated<NonEmptyList<E>, A>` | 폼 검증 등 다중 오류 수집 |
| 비동기 + 에러 | `Mono<Either<DomainError, T>>` | WebFlux 환경 |
| 단순 null 대체 | `Option<T>` | 선택적이나 현재 TicketRush에서는 미사용 |

---

## 8. 확산 로드맵

| 스프린트 | 모듈 | 작업 | 담당 |
|---------|------|------|------|
| W2 | `:order-api` | `OrderService` 파일럿 | 박지훈 |
| W3 | 팀 공유 세션 | 공유 + 피드백 | 박지훈 |
| W4~ | `:payment-api` | `PaymentService` 확산 | 박지훈 (W4 완료) |
| W6 | `:queue-api` | `QueueService.enter()` 적용 | 강민서 (W6 예정) |
| W6 | `:seat-api` | `OrderCreatedConsumer` 검증 로직 | 강민서 (W6 예정) |

---

*본 문서는 박지훈 KPI 7 "Arrow-kt 파일럿 모듈 적용 후 팀 공유 세션 1회 이상 및 도입 가이드 작성"의 공식 산출물이다.*
