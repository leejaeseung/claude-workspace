# Arrow-kt 공유 세션 — W3

**작성자**: 박지훈 (feature-develop 팀 리더)  
**날짜**: 2026-05-30  
**대상**: 팀 전원 (특히 강민서 — Arrow-kt 기초 수준)

---

## 1. 왜 Arrow-kt인가

### 기존 방식의 문제

```kotlin
// 문제: 예외를 던지면 호출자가 이걸 알아야 한다 (암묵적 계약)
fun createOrder(userId: String): Order {
    if (userId.isBlank()) throw IllegalArgumentException("userId 비어있음")
    // ...
}

// 호출 시 try-catch 강제 — 하지만 컴파일러는 강제하지 않는다
try {
    val order = createOrder("")
} catch (e: IllegalArgumentException) {
    // 깜빡하면 런타임 크래시
}
```

**핵심 문제**: 함수 시그니처만 봐서는 실패 가능성을 알 수 없다.

### Arrow-kt 방식

```kotlin
// 성공(Right) 또는 실패(Left)가 타입에 명시된다
fun createOrder(userId: String): Either<DomainError, Order>
```

함수 시그니처만 봐도 "이 함수는 실패할 수 있고, 실패하면 DomainError를 반환한다"는 것을 알 수 있다.

---

## 2. Railway-Oriented Programming

데이터가 두 개의 레일을 따라 흐른다고 생각하면 된다.

```
입력 ──▶ 검증1 ──▶ 검증2 ──▶ DB저장 ──▶ 성공 (Right 레일)
                │              │
           실패 시 Left    실패 시 Left
                ▼              ▼
           오류 레일 ──────────────▶ 오류 처리 (Left 레일)
```

한 번 Left(오류)로 빠지면 이후 단계는 **자동으로 스킵**된다.

---

## 3. Either<L, R> 기본

```kotlin
import arrow.core.Either
import arrow.core.left
import arrow.core.right

// Right = 성공
val success: Either<String, Int> = 42.right()

// Left = 실패
val failure: Either<String, Int> = "오류 발생".left()

// 사용 (when으로 패턴 매칭)
when (success) {
    is Either.Right -> println("성공: ${success.value}")
    is Either.Left  -> println("실패: ${success.value}")
}
```

---

## 4. 실제 코드 — Before / After

### Before (예외 방식)

```kotlin
fun createOrder(userId: String, seatId: Long): Order {
    if (userId.isBlank()) throw IllegalArgumentException("userId 비어있음")
    if (seatId <= 0) throw IllegalArgumentException("seatId 유효하지 않음")
    return orderRepository.save(OrderEntity(userId, seatId))
}
```

### After (Arrow-kt Either 방식)

실제 `OrderService.kt`에서 발췌:

```kotlin
@Transactional
fun createOrder(userId: String, seatId: Long, showId: Long): Either<DomainError, Order> =
    either {
        validateUserId(userId).bind()   // 실패 시 자동으로 Left로 빠짐
        validateSeatId(seatId).bind()   // 실패 시 자동으로 Left로 빠짐

        val saved = orderRepository.save(...)
        Order(id = saved.id, ...)
    }

private fun validateUserId(userId: String): Either<DomainError, Unit> =
    if (userId.isNotBlank()) Unit.right()
    else DomainError.UnauthorizedAccess(userId).left()
```

**핵심**: `either { ... }` 블록 안에서 `.bind()`를 호출하면, Left가 반환되는 순간 이후 코드가 실행되지 않는다.

---

## 5. either { } 블록 사용법

### bind()
```kotlin
either {
    val result1 = step1().bind()  // Either<E, A> → A (실패 시 즉시 Left 반환)
    val result2 = step2(result1).bind()
    result2  // 마지막 값이 Right로 반환됨
}
```

### raise()
```kotlin
either {
    val value = someValue
    if (value < 0) raise(DomainError.InvalidValue)  // 명시적으로 Left 반환
    value
}
```

---

## 6. 우리 팀 코드에서 쓰는 곳

| 파일 | 적용 포인트 |
|------|------------|
| `OrderService.createOrder()` | userId/seatId 검증 → 주문 생성 |
| `PaymentService.processPayment()` | 멱등성 체크 → PG 호출 |
| `SeatLockService.acquire()` | Redis 락 획득 성공/실패 |

### 강민서가 대기열에서 적용할 수 있는 곳

```kotlin
// QueueService.enter()에 Arrow-kt 적용 예시
fun enter(userId: String, showId: Long): Either<DomainError, QueueEntry> = either {
    if (userId.isBlank()) raise(DomainError.UnauthorizedAccess(userId))
    // ... 기존 로직
}
```

지금 당장 바꿀 필요는 없다. W4에서 기회가 생기면 적용해보자.

---

## 7. 함정 주의

### 함정 1: either 블록 안에서 예외 던지기

```kotlin
either {
    // ❌ 이렇게 하면 안 됨 — Either로 잡히지 않고 예외가 그냥 전파됨
    if (bad) throw RuntimeException("오류")

    // ✅ 이렇게 해야 함
    if (bad) raise(DomainError.SomeError)
}
```

### 함정 2: Either vs Validated

- `Either`: 첫 번째 실패에서 즉시 멈춤 (단일 오류)
- `Validated`: 모든 검증을 다 돌고 오류를 누적 (복수 오류 — 폼 유효성 검증 등)

대부분은 `Either`로 충분하다.

---

**다음 스텝**: W4에서 강민서의 대기열 도메인에 `Either` 적용 파일럿 예정.
