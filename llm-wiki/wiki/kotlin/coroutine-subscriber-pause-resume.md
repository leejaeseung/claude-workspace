# Broadcast Stream에서 Subscriber 중단과 재개

> **공식 문서**: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/  
> **공식 문서**: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-companion/-while-subscribed.html  
> **공식 문서**: https://kotlinlang.org/docs/flow.html  
> **버전**: kotlinx.coroutines 1.8.x  
> **최초 작성**: 2026-04-25

---

## 핵심 질문: 구독을 중단했다 재개하면 놓친 값을 받을 수 있는가?

> **답: replay cache에 남아 있는 값만 복구 가능하다. 그 외의 값은 영구 손실된다.**

Flow에는 "일시 정지(pause)" API가 없다. 구독 중단은 두 가지 의미를 가진다.

| 중단 방식 | 설명 | 값 손실 여부 |
|-----------|------|------------|
| **느린 collect** (Slow Consumer) | collect 람다가 오래 걸려 publisher가 대기 | 없음 (publisher가 suspend됨) |
| **취소 후 재구독** (Cancel & Resubscribe) | scope 취소 또는 cancel()로 collect 종료 후 재collect | replay cache 초과분은 손실 |

---

## 1. 느린 Subscriber — Publisher가 멈춘다 (Backpressure)

### 기본 동작

`MutableSharedFlow`의 기본 설정(`replay=0, extraBufferCapacity=0, onBufferOverflow=SUSPEND`)에서:

```kotlin
val flow = MutableSharedFlow<Int>()  // 기본 설정

// publisher
launch {
    for (i in 1..5) {
        flow.emit(i)          // 모든 구독자가 받을 때까지 suspend
        println("emitted $i")
    }
}

// slow subscriber
flow.collect { value ->
    delay(500)               // 처리 시간이 길다
    println("collected $value")
}
```

**결과**: emit은 collect가 완료될 때까지 suspend된다. 값 손실 없음.

### 구독자 없을 때 emit 동작

```
구독자가 없으면 emit()은 즉시 반환된다 (기본 설정 replay=0 기준).
값은 저장되지 않으므로 이후 구독자는 받지 못한다.
```

공식 문서 명시:
> *"In the absence of subscribers only the most recent replay values are stored and the buffer overflow behavior is never triggered and has no effect."*

---

## 2. Buffer 전략 — Publisher와 Subscriber를 분리

### buffer() 연산자 (Cold Flow에서 사용)

```kotlin
fun <T> Flow<T>.buffer(
    capacity: Int = BUFFERED,
    onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND
): Flow<T>
```

Emitter와 Collector를 **별도 코루틴**으로 분리하여 동시 실행한다.

```kotlin
flow {
    for (i in 1..3) {
        delay(100)
        emit(i)
    }
}
.buffer()             // emitter 코루틴과 collector 코루틴을 분리
.collect { value ->
    delay(300)
    println(value)
}
// 버퍼 없이: ~1200ms
// 버퍼 있이: ~1000ms (emitter가 먼저 다 채움)
```

### extraBufferCapacity (SharedFlow에서 사용)

```kotlin
val flow = MutableSharedFlow<Int>(
    replay = 0,
    extraBufferCapacity = 64,              // slow subscriber 대기 버퍼
    onBufferOverflow = BufferOverflow.DROP_OLDEST
)
```

| 파라미터 | 역할 |
|----------|------|
| `replay` | 재구독 시 복구 가능한 과거 값 개수 |
| `extraBufferCapacity` | 느린 구독자를 위한 추가 큐 크기 |

두 값을 합산한 크기만큼 subscriber가 처리 지연되어도 publisher는 계속 진행 가능.

### onBufferOverflow 전략 비교

| 전략 | 동작 | 적합한 상황 |
|------|------|-----------|
| `SUSPEND` (기본) | 버퍼 가득 시 publisher 정지 | 모든 값 보장 필요 |
| `DROP_OLDEST` | 오래된 값 버리고 신규 삽입 | 최신 값이 중요한 경우 |
| `DROP_LATEST` | 신규 값 버림 | 기존 처리 중인 값이 중요한 경우 |

---

## 3. 취소 후 재구독 — 놓친 값 처리

### replay cache의 역할

공식 문서:
> *"Every new subscriber first gets the values from the replay cache and then gets new emitted values."*

```kotlin
val flow = MutableSharedFlow<Int>(replay = 3)

// 값 5개 발행
listOf(1, 2, 3, 4, 5).forEach { flow.tryEmit(it) }
// → replay cache: [3, 4, 5]

// 재구독
flow.collect { println(it) }
// 출력: 3, 4, 5 (이후 신규 발행값도 수신)
```

### replay 설정별 재구독 결과

| replay 설정 | 재구독 시 수신 | 중단 중 발행된 값 |
|------------|--------------|---------------|
| `replay = 0` | 재구독 이후 신규 발행값만 | **전부 손실** |
| `replay = 1` | 가장 최근 1개 + 신규값 | 1개 복구, 나머지 손실 |
| `replay = N` | 최근 N개 + 신규값 | N개 복구, 나머지 손실 |

### replay = 0일 때 재구독 시나리오

```
[publisher] 1, 2, 3 발행  →  [구독자 A 수신: 1, 2, 3]
[구독자 A] collect 취소
[publisher] 4, 5, 6 발행  →  구독자 없음, 값 손실
[구독자 A] 재구독
[publisher] 7, 8, 9 발행  →  [구독자 A 수신: 7, 8, 9]
결과: 4, 5, 6은 영구 손실
```

### replay = 2일 때 재구독 시나리오

```
[publisher] 1, 2, 3, 4, 5 발행  →  [구독자 A 수신: 1~5]
[구독자 A] collect 취소
[publisher] 6, 7, 8 발행
  → replay cache 갱신: [7, 8]  (최근 2개 유지)
[구독자 A] 재구독
  → 먼저 수신: 7, 8  (replay cache)
  → 이후 신규 발행값 수신
결과: 6은 손실, 7~8은 복구
```

---

## 4. WhileSubscribed — 재구독 시 replay cache 만료 제어

`shareIn` / `stateIn`에서 `SharingStarted.WhileSubscribed`를 사용하면 구독자 이탈 후 replay cache 만료 시점을 제어할 수 있다.

```kotlin
SharingStarted.WhileSubscribed(
    stopTimeoutMillis = 0L,           // 마지막 구독자 이탈 후 upstream 중단까지 대기 (기본 0)
    replayExpirationMillis = Long.MAX_VALUE  // upstream 중단 후 replay cache 만료까지 대기 (기본 영구)
)
```

### 파라미터별 시나리오

```
구독자 모두 이탈
    ↓ stopTimeoutMillis 경과
upstream 중단
    ↓ replayExpirationMillis 경과
replay cache 초기화
```

| replayExpirationMillis | 재구독 시 수신 |
|-----------------------|--------------|
| `Long.MAX_VALUE` (기본) | replay cache 그대로 유지 — 재구독 시 이전 값 수신 |
| `0` | upstream 중단 즉시 cache 만료 — 재구독 시 initialValue(stateIn) 또는 빈 cache(shareIn) |
| `N` | N ms 안에 재구독 시 cache 유지, 이후 재구독은 초기화된 cache |

### Android ViewModel 권장 패턴

```kotlin
// 화면 전환(재구독)이 5초 내에 이루어지면 cache 유지
val uiState: StateFlow<UiState> = repository.dataFlow
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(
            stopTimeoutMillis = 5_000L,       // 5초 내 재구독 시 upstream 재시작 안 함
            replayExpirationMillis = Long.MAX_VALUE  // cache 영구 유지
        ),
        initialValue = UiState.Loading
    )
```

---

## 5. conflate / collectLatest — 중간값을 버리는 전략

subscriber가 느릴 때 값을 손실 없이 유지하는 대신 **일부 값을 의도적으로 버리는** 전략.

### conflate

최신 값만 유지, 중간값 버림.

```kotlin
simpleFlow()
    .conflate()
    .collect { value ->
        delay(300)
        println(value)
    }
// 출력: 1, 3  (2는 1 처리 중에 3으로 덮어씌워짐)
```

### collectLatest

새 값 도착 시 이전 처리 블록을 취소하고 재시작.

```kotlin
simpleFlow()
    .collectLatest { value ->
        delay(300)
        println("done $value")  // 마지막 값만 완료
    }
// 출력: done 3  (1, 2의 블록은 취소됨)
```

---

## 6. Channel — 보장 전달이 필요할 때

SharedFlow는 replay cache를 초과한 값을 복구할 수 없다. **모든 값을 반드시 처리해야 하는 경우** Buffered Channel을 사용한다.

```kotlin
val channel = Channel<Event>(capacity = Channel.UNLIMITED)

// producer
launch {
    repeat(100) { channel.send(Event(it)) }
}

// consumer (느려도 손실 없음)
launch {
    for (event in channel) {
        delay(200)
        process(event)
    }
}
```

### Channel vs SharedFlow 재구독 비교

| 구분 | Channel | SharedFlow |
|------|---------|-----------|
| 값 보장 | 버퍼에 남아 있는 한 보장 | replay cache 이내만 보장 |
| 다중 구독자 | 한 값을 한 명만 수신 (Fan-out) | 모든 구독자 동시 수신 |
| 재구독 후 수신 | 채널이 열려 있으면 수신 가능 | replay cache 이내만 수신 |

---

## 7. 패턴 정리: 상황별 전략

### 상황 A: 재구독 시 놓친 값을 일부 복구해야 한다

```kotlin
MutableSharedFlow<T>(
    replay = N,                          // 최근 N개 보존
    extraBufferCapacity = M,             // 추가 버퍼
    onBufferOverflow = BufferOverflow.DROP_OLDEST
)
```

### 상황 B: 모든 값을 반드시 처리해야 한다 (손실 0)

```kotlin
val channel = Channel<T>(Channel.UNLIMITED)
// 또는
val channel = Channel<T>(capacity = 1024)
```

### 상황 C: 최신 상태만 필요하다 (중간 상태 무관)

```kotlin
MutableStateFlow<T>(initialValue)
// 재구독 시 항상 현재 상태 1개 수신
```

### 상황 D: 구독자가 잠시 없을 때 upstream을 유지하고 싶다

```kotlin
flow.shareIn(
    scope,
    SharingStarted.WhileSubscribed(stopTimeoutMillis = 5_000L),
    replay = 1
)
```

### 상황 E: 느린 subscriber가 publisher를 block하지 않게 하면서 최신값만 전달

```kotlin
flow
    .conflate()               // 또는 .buffer(onBufferOverflow = BufferOverflow.DROP_OLDEST)
    .collect { ... }
```

---

## 8. 동작 요약

```
┌──────────────────────────────────────────────────────────────┐
│  구독 취소 후 재구독 시 수신 가능한 값                         │
│                                                              │
│  replay = 0  →  재구독 이전 모든 값 손실                      │
│  replay = N  →  최근 N개만 복구 (나머지 손실)                 │
│  StateFlow   →  항상 최신 1개 복구                           │
│  Channel     →  버퍼에 남은 모든 값 복구                     │
│                                                              │
│  "일시 정지" API는 없다.                                     │
│  느린 collect → publisher suspend (SUSPEND 전략 시)           │
│  취소 후 재구독 → replay cache 이내만 수신                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 관련 페이지

- [[wiki/kotlin/coroutine-stream-broadcast]] — SharedFlow/StateFlow/Channel broadcast 개요
