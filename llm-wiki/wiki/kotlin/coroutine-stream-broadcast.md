# Coroutine에서 Stream을 활용한 데이터 Broadcast

> **공식 문서**: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/  
> **공식 문서**: https://kotlinlang.org/docs/channels.html  
> **버전**: kotlinx.coroutines 1.8.x  
> **최초 작성**: 2026-04-25

---

## 개요

Kotlin Coroutines에서 **데이터 브로드캐스트**는 하나의 데이터 소스가 여러 구독자(collector)에게 동시에 값을 전달하는 패턴이다.  
이를 구현하는 핵심 도구는 **SharedFlow**, **StateFlow**, **Channel**이다.

### Cold vs Hot Stream

| 구분 | Cold Flow | Hot Flow |
|------|-----------|----------|
| 시작 시점 | 각 collect 호출 시 | 수집자 유무와 무관하게 독립 실행 |
| 구독자 수 | 1개 (unicast) | N개 (broadcast) |
| 데이터 공유 | 각 수집자에게 독립 스트림 | 모든 수집자에게 동일 스트림 공유 |
| 대표 구현 | `flow { }`, `flowOf()` | `SharedFlow`, `StateFlow` |

브로드캐스트에는 **Hot Stream**이 필요하다.

---

## SharedFlow — 범용 브로드캐스트

### 정의

```kotlin
interface SharedFlow<out T> : Flow<T>
```

수집자 존재 여부와 무관하게 독립적으로 활성 상태를 유지하는 핫 플로우.  
발행된 값을 **모든 구독자에게 동시에** 전달한다.

### 기본 사용

```kotlin
val _events = MutableSharedFlow<String>()
val events: SharedFlow<String> = _events.asSharedFlow()

// 발행
suspend fun emit(value: String) = _events.emit(value)

// 수집 (여러 곳에서 동시에 가능)
events.collect { println("수신: $it") }
```

### 핵심 파라미터

```kotlin
MutableSharedFlow<T>(
    replay = 0,                            // 신규 구독자에게 재전송할 과거 값 개수
    extraBufferCapacity = 0,               // 추가 버퍼 크기
    onBufferOverflow = BufferOverflow.SUSPEND  // 버퍼 초과 시 전략
)
```

**replay 파라미터 의미**:
- `replay = 0`: 구독 이후 발행된 값만 수신 (기본값)
- `replay = 1`: 구독 시점에 가장 최근 값 1개를 즉시 수신
- `replay = N`: 구독 시점에 최근 N개 값을 즉시 수신

**BufferOverflow 전략**:

| 전략 | 동작 |
|------|------|
| `SUSPEND` (기본) | 버퍼가 가득 차면 발행자 일시 정지 |
| `DROP_OLDEST` | 가장 오래된 값 삭제 후 신규 값 삽입 |
| `DROP_LATEST` | 신규 값 버림 (기존 버퍼 유지) |

### 발행 방식

```kotlin
// suspend 방식 — 모든 구독자가 받을 때까지 대기
_events.emit(value)

// non-blocking 방식 — 실패 시 false 반환
val success = _events.tryEmit(value)
```

### Event Bus 패턴

```kotlin
class AppEventBus {
    private val _flow = MutableSharedFlow<AppEvent>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val flow: SharedFlow<AppEvent> = _flow.asSharedFlow()

    fun publish(event: AppEvent) {
        _flow.tryEmit(event)  // 코루틴 컨텍스트 불필요
    }
}

// 소비
scope.launch {
    eventBus.flow.collect { event ->
        when (event) {
            is AppEvent.UserLoggedIn -> handleLogin(event)
            is AppEvent.DataRefresh -> refresh()
        }
    }
}
```

---

## StateFlow — 상태 브로드캐스트

### 정의

SharedFlow의 특수 구현으로, **단일 상태 값**을 여러 수집자에게 공유한다.

```kotlin
// MutableStateFlow(initial)는 다음 SharedFlow 설정과 동등:
MutableSharedFlow(
    replay = 1,
    onBufferOverflow = BufferOverflow.DROP_OLDEST
).also { it.tryEmit(initialValue) }
    .distinctUntilChanged()
```

### 주요 특성

| 특성 | 동작 |
|------|------|
| 초기값 필수 | 생성 시 반드시 초기값 제공 |
| 중복 억제 | `equals()` 기반으로 동일 값은 재발행 안 함 |
| 항상 최신값 보유 | `value` 프로퍼티로 언제든 동기 읽기 가능 |
| replay = 1 고정 | 신규 구독자는 항상 현재 상태 즉시 수신 |
| 완료 불가 | 취소만 가능, 정상 완료 없음 |

### 기본 사용

```kotlin
class UiViewModel {
    private val _uiState = MutableStateFlow(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            val data = repository.fetch()
            _uiState.value = UiState.Success(data)
        }
    }
}

// UI에서 수집
viewModel.uiState.collect { state ->
    when (state) {
        is UiState.Loading -> showSpinner()
        is UiState.Success -> showData(state.data)
    }
}

// 동기 읽기 (언제든 가능)
val current = viewModel.uiState.value
```

### 여러 StateFlow 결합

```kotlin
val combined: Flow<Int> = 
    flow1.combine(flow2) { a, b -> a + b }
```

---

## SharedFlow vs StateFlow 선택 기준

| 상황 | 권장 |
|------|------|
| 상태 관리 (UI state, 설정값) | **StateFlow** |
| 이벤트 브로드캐스트 (클릭, 알림) | **SharedFlow** |
| 현재 값을 동기 읽기가 필요 | **StateFlow** |
| 같은 값을 여러 번 발행해야 함 | **SharedFlow** |
| 초기값이 없어도 되는 경우 | **SharedFlow** |

---

## Cold Flow → Hot 브로드캐스트 변환

### shareIn

```kotlin
fun <T> Flow<T>.shareIn(
    scope: CoroutineScope,
    started: SharingStarted,
    replay: Int = 0
): SharedFlow<T>
```

Cold Flow를 SharedFlow로 변환하여 여러 구독자가 하나의 upstream을 공유하게 한다.

```kotlin
// DB 쿼리 결과를 여러 화면에서 공유
val sharedData: SharedFlow<List<Item>> = repository.queryFlow()
    .shareIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        replay = 1
    )
```

**SharingStarted 옵션 비교**:

| 옵션 | upstream 시작 | upstream 중단 | 주요 용도 |
|------|-------------|-------------|---------|
| `Eagerly` | 즉시 | 안 함 | 항상 실행 필요한 스트림 |
| `Lazily` | 첫 구독자 등장 시 | 안 함 | 한 번 시작 후 유지 |
| `WhileSubscribed(timeout)` | 첫 구독자 등장 시 | 마지막 구독자 사라진 후 timeout 후 | 리소스 절약 (Android ViewModel 권장) |

```kotlin
// WhileSubscribed: 모든 구독자가 사라진 후 5초 뒤 upstream 중단
.shareIn(scope, SharingStarted.WhileSubscribed(5_000L), replay = 1)
```

### stateIn

```kotlin
fun <T> Flow<T>.stateIn(
    scope: CoroutineScope,
    started: SharingStarted,
    initialValue: T
): StateFlow<T>
```

Cold Flow를 StateFlow로 변환한다.

```kotlin
val uiState: StateFlow<UiState> = repository.dataFlow
    .map { data -> UiState.Success(data) }
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000L),
        initialValue = UiState.Loading
    )
```

---

## Channel — 코루틴 간 일대다 메시지 전달

### Channel 종류

| 종류 | capacity | 동작 |
|------|----------|------|
| Rendezvous (기본) | 0 | sender/receiver 동시 만남 필요 |
| Buffered | 정수 | 버퍼 가득 찰 때까지 sender 비중단 |
| Unlimited | `Channel.UNLIMITED` | 버퍼 무제한 |
| Conflated | `Channel.CONFLATED` | 최신 값 1개만 유지 |

### Fan-out — 1 Producer → N Consumers (작업 분산)

여러 코루틴이 **같은 채널**에서 수신하여 작업을 나눠 처리한다.

```kotlin
fun CoroutineScope.produceJobs(): ReceiveChannel<Job> = produce {
    var i = 1
    while (true) { send(Job(i++)); delay(100) }
}

fun CoroutineScope.worker(id: Int, channel: ReceiveChannel<Job>) = launch {
    for (job in channel) {
        println("Worker $id processing $job")
    }
}

val producer = produceJobs()
repeat(4) { id -> worker(id, producer) }  // 4명의 워커가 작업 분배
```

> SharedFlow와 달리 Fan-out에서는 각 메시지가 하나의 수신자에게만 전달된다.

### Fan-in — N Producers → 1 Consumer

여러 코루틴이 **같은 채널**에 송신한다.

```kotlin
val resultChannel = Channel<ProcessResult>()

repeat(4) { id ->
    launch {
        val result = processHeavyWork(id)
        resultChannel.send(result)
    }
}

repeat(4) {
    println(resultChannel.receive())
}
```

### Pipeline — 스트림 변환 체인

```kotlin
fun CoroutineScope.numbers() = produce<Int> {
    var x = 1; while (true) send(x++)
}

fun CoroutineScope.filter(src: ReceiveChannel<Int>, pred: (Int) -> Boolean) =
    produce<Int> { for (x in src) if (pred(x)) send(x) }

fun CoroutineScope.map(src: ReceiveChannel<Int>, f: (Int) -> Int) =
    produce<Int> { for (x in src) send(f(x)) }

// 사용
val evens = filter(numbers(), { it % 2 == 0 })
val doubled = map(evens, { it * 2 })
repeat(5) { println(doubled.receive()) }  // 4, 8, 12, 16, 20
```

---

## Broadcast 패턴 비교 요약

| 패턴 | 구현 | 각 메시지 수신자 | 과거 값 | 용도 |
|------|------|---------------|--------|------|
| SharedFlow | `MutableSharedFlow` | **모든** 구독자 | replay 설정 가능 | 이벤트 브로드캐스트 |
| StateFlow | `MutableStateFlow` | **모든** 구독자 | 최신 1개 항상 | UI 상태 공유 |
| Fan-out Channel | `Channel` + N collectors | 구독자 중 **1명** | 없음 | 작업 분산 처리 |
| shareIn | `.shareIn(...)` | **모든** 구독자 | replay 설정 가능 | Cold → Hot 변환 |

---

## BroadcastChannel 마이그레이션 (Deprecated)

BroadcastChannel은 deprecated. 다음과 같이 마이그레이션한다:

```kotlin
// 이전 (Deprecated)
val channel = BroadcastChannel<Int>(capacity = 10)
val subscription = channel.openSubscription()
channel.send(1)
subscription.receive()

// 이후 (권장)
val flow = MutableSharedFlow<Int>(extraBufferCapacity = 10)
flow.emit(1)
flow.collect { }
```

---

## 관련 페이지

- [[wiki/kotlin/coroutine-subscriber-pause-resume]] — Subscriber 중단과 재개, 놓친 값 처리 전략
- [[wiki/kotlin/coroutines-overview]] — Kotlin 코루틴 전체 개요
- [[wiki/spring/spring-batch/scaling]] — Spring Batch에서의 병렬 처리 패턴
