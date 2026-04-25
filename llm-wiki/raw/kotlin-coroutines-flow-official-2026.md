# 원본: Kotlin Coroutines Flow / Channel 공식 문서

> **수집일**: 2026-04-25  
> **절대 수정 금지**

---

## 공식 출처 URLs

- SharedFlow API: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/
- StateFlow API: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/
- shareIn 연산자: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/share-in.html
- Channels 가이드: https://kotlinlang.org/docs/channels.html
- kotlinx.coroutines Flow 패키지: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/

---

## SharedFlow (공식 API 문서)

**인터페이스 정의:**
```kotlin
interface SharedFlow<out T> : Flow<T>
```

SharedFlow는 모든 수집자(collector)에게 발행된 값을 브로드캐스트 방식으로 공유하는 **핫(hot) Flow**입니다.  
수집자 존재 여부와 관계없이 독립적으로 활성 상태를 유지합니다.

### Replay Cache
- 발행된 최근 값들을 저장하며, 새 구독자는 먼저 캐시 값들을 받음
- `abstract val replayCache: List<T>`
- `mutableSharedFlow.resetReplayCache()` 로 리셋 가능

### Buffer 전략
```kotlin
// 기본: unbuffered
val flow = MutableSharedFlow<Event>()  // replay=0, extraBufferCapacity=0

// buffer 포함
val flow = MutableSharedFlow<Event>(
    replay = 1,
    extraBufferCapacity = 5
)

// BufferOverflow 전략
val flow = MutableSharedFlow<Event>(
    replay = 0,
    extraBufferCapacity = 10,
    onBufferOverflow = BufferOverflow.DROP_OLDEST
)
```

BufferOverflow 옵션:
- `SUSPENDED` (기본): 발행자 대기
- `DROP_OLDEST`: 가장 오래된 값 삭제
- `DROP_LATEST`: 최신 값 삭제

구독자가 없으면 버퍼 오버플로우 조건이 발생하지 않음.

### 발행 방식
```kotlin
mutableSharedFlow.emit(value)       // suspend - 완료 대기
mutableSharedFlow.tryEmit(value)    // non-blocking - Boolean 반환
```

### 이벤트 버스 예제
```kotlin
class EventBus {
    private val _events = MutableSharedFlow<Event>()
    val events = _events.asSharedFlow()
    
    suspend fun produceEvent(event: Event) {
        _events.emit(event)
    }
}
```

### SharedFlow vs BroadcastChannel
- BroadcastChannel은 Deprecated → MutableSharedFlow로 마이그레이션
- `BroadcastChannel(capacity)` → `MutableSharedFlow(0, extraBufferCapacity=capacity)`
- `send()` → `emit()`, `trySend()` → `tryEmit()`

### 성능 특성
- 모든 메서드 thread-safe
- 구독자 추가: O(1) amortized cost
- 발행: O(N) cost (N = 구독자 수)

---

## StateFlow (공식 API 문서)

**MutableStateFlow 생성 시 동등한 SharedFlow 설정:**
```kotlin
val shared = MutableSharedFlow(
    replay = 1,
    onBufferOverflow = BufferOverflow.DROP_OLDEST)
shared.tryEmit(initialValue)
val state = shared.distinctUntilChanged()
```

**기본 사용법:**
```kotlin
class CounterModel {
    private val _counter = MutableStateFlow(0)
    val counter = _counter.asStateFlow()
    
    fun inc() {
        _counter.update { count -> count + 1 }
    }
}
```

**StateFlow 결합:**
```kotlin
val sumFlow: Flow<Int> = aModel.counter.combine(bModel.counter) { a, b -> a + b }
```

### 특성
| 특성 | 설명 |
|------|------|
| 초기값 필수 | 항상 초기값을 가져야 함 |
| 완료 불가 | 절대 완료되지 않음 |
| Conflation | equals() 기반으로 동일한 값은 방출하지 않음 |
| Replay | 최신 값 1개만 새로운 수집자에게 제공 |
| Thread-safe | 모든 메서드가 스레드 안전 |

---

## shareIn 연산자 (공식 API 문서)

```kotlin
fun <T> Flow<T>.shareIn(
    scope: CoroutineScope, 
    started: SharingStarted, 
    replay: Int = 0
): SharedFlow<T>
```

Cold Flow를 Hot SharedFlow로 변환하여 여러 구독자와 공유합니다.

### SharingStarted 옵션

| 옵션 | 동작 |
|------|------|
| `Eagerly` | 첫 구독자 전에 즉시 시작, 구독자가 없어도 계속 실행 |
| `Lazily` | 첫 구독자 등장 시 시작, 마지막 구독자 후에도 upstream 유지 |
| `WhileSubscribed()` | 첫 구독자 시 시작, 마지막 구독자 사라질 때 중단 |

### 예제
```kotlin
// Eagerly
val messages: SharedFlow<Message> = backendMessages.shareIn(scope, SharingStarted.Eagerly)

// 재시도 포함
val messages = backendMessages
    .retry { e ->
        val shallRetry = e is IOException
        if (shallRetry) delay(1000)
        shallRetry
    }
    .shareIn(scope, SharingStarted.Eagerly)
```

---

## Channel (공식 가이드)

Channel은 코루틴 간 스트림 형태의 값 전달 방식. BlockingQueue와 유사하지만 suspending 방식 사용.

```kotlin
val channel = Channel<Int>()
launch {
    for (x in 1..5) channel.send(x * x)
}
repeat(5) { println(channel.receive()) }
```

### Channel 종류
| 종류 | capacity 값 | 동작 |
|------|------------|------|
| Unbuffered (Rendezvous) | 기본 | sender/receiver 동시 만남 필요 |
| Buffered | 정수값 | buffer가 가득 찰 때까지 sender 비중단 |
| Unlimited | Channel.UNLIMITED | buffer 무제한 |
| Conflated | Channel.CONFLATED | 최신 1개 값만 유지 |

### Fan-out 패턴
여러 코루틴이 같은 channel에서 수신 (작업 분산)
```kotlin
fun CoroutineScope.produceNumbers() = produce<Int> {
    var x = 1
    while (true) { send(x++); delay(100) }
}

fun CoroutineScope.launchProcessor(id: Int, channel: ReceiveChannel<Int>) = launch {
    for (msg in channel) { println("Processor #$id received $msg") }
}

val producer = produceNumbers()
repeat(5) { launchProcessor(it, producer) }
```

### Fan-in 패턴
여러 코루틴이 같은 channel에 송신
```kotlin
suspend fun sendString(channel: SendChannel<String>, s: String, time: Long) {
    while (true) { delay(time); channel.send(s) }
}

val channel = Channel<String>()
launch { sendString(channel, "foo", 200L) }
launch { sendString(channel, "BAR!", 500L) }
```

### Pipeline 패턴
```kotlin
fun CoroutineScope.produceNumbers() = produce<Int> {
    var x = 1
    while (true) send(x++)
}

fun CoroutineScope.square(numbers: ReceiveChannel<Int>) = produce<Int> {
    for (x in numbers) send(x * x)
}
```
