# Spring Batch 병렬 처리 및 확장

> 관련 원본: [[raw/spring-batch-official-docs-2026]]
> 관련 페이지: [[spring-batch/chunk-processing]]
> 최초 작성: 2026-04-21

---

## 확장 전략 4가지 비교

| 전략 | 단위 | 복잡도 | 재시작 안전성 | 적합한 상황 |
|------|------|--------|-------------|-----------|
| **Multi-threaded Step** | 청크 | 낮음 | ⚠️ Reader 주의 | 빠른 병렬화, 순서 무관 |
| **Parallel Steps** | Step | 낮음 | ✅ | 독립적인 여러 Step 동시 실행 |
| **Partitioning** | 데이터 파티션 | 중간 | ✅ | 대용량 단일 데이터셋 분할 |
| **Remote Chunking** | 청크 (원격) | 높음 | ⚠️ 메시지 보장 필요 | 처리 부하를 원격 워커로 분산 |

---

## 1. Multi-threaded Step

단일 Step 내 청크를 여러 스레드에서 병렬 처리한다.

```java
@Bean
public Step multiThreadedStep(JobRepository jobRepository,
                               PlatformTransactionManager transactionManager) {
    return new StepBuilder("multiThreadedStep", jobRepository)
        .<Input, Output>chunk(100, transactionManager)
        .reader(itemReader())
        .writer(itemWriter())
        .taskExecutor(new SimpleAsyncTaskExecutor())  // 스레드 풀
        .throttleLimit(10)  // 최대 동시 스레드 수
        .build();
}
```

> ⚠️ 주의: `JdbcCursorItemReader` 같은 stateful Reader는 스레드 안전하지 않다.
> Multi-threaded Step에서는 `JdbcPagingItemReader` 또는 `SynchronizedItemStreamReader`를 사용해야 한다.

---

## 2. Parallel Steps (Flow)

서로 독립적인 Step들을 동시에 실행한다.

```java
@Bean
public Job parallelJob(JobRepository jobRepository) {
    Flow flow1 = new FlowBuilder<SimpleFlow>("flow1")
        .start(step1())
        .build();

    Flow flow2 = new FlowBuilder<SimpleFlow>("flow2")
        .start(step2())
        .build();

    Flow splitFlow = new FlowBuilder<SimpleFlow>("splitFlow")
        .split(new SimpleAsyncTaskExecutor())
        .add(flow1, flow2)  // flow1과 flow2 병렬 실행
        .build();

    return new JobBuilder("parallelJob", jobRepository)
        .start(splitFlow)
        .next(step3())  // 두 flow 완료 후 step3 실행
        .end()
        .build();
}
```

---

## 3. Partitioning

대용량 데이터를 파티션으로 분할해 각 파티션을 독립 Step으로 처리한다.

```
Master Step
  ├── Partition 1 (Worker Step: ID 1~10000)
  ├── Partition 2 (Worker Step: ID 10001~20000)
  ├── Partition 3 (Worker Step: ID 20001~30000)
  └── ...
```

```java
@Bean
public Step masterStep(JobRepository jobRepository) {
    return new StepBuilder("masterStep", jobRepository)
        .partitioner("workerStep", partitioner())      // 파티션 생성
        .step(workerStep())                            // 각 파티션에서 실행할 Step
        .gridSize(10)                                  // 파티션 수
        .taskExecutor(new SimpleAsyncTaskExecutor())
        .build();
}

@Bean
public Partitioner partitioner() {
    // 파티션별 ExecutionContext 생성 (범위 정보 포함)
    return gridSize -> {
        Map<String, ExecutionContext> result = new HashMap<>();
        int range = totalCount / gridSize;
        for (int i = 0; i < gridSize; i++) {
            ExecutionContext context = new ExecutionContext();
            context.putInt("minId", i * range + 1);
            context.putInt("maxId", (i + 1) * range);
            result.put("partition" + i, context);
        }
        return result;
    };
}
```

**Worker Step에서 파티션 정보 사용**:
```java
@StepScope
@Bean
public JdbcPagingItemReader<User> workerReader(
        @Value("#{stepExecutionContext['minId']}") int minId,
        @Value("#{stepExecutionContext['maxId']}") int maxId) {
    // minId ~ maxId 범위만 읽기
}
```

---

## 4. Remote Chunking

읽기는 Manager(로컬)가 담당하고, 처리/쓰기는 원격 Worker가 수행한다.
Spring Integration의 메시지 채널을 통해 통신한다.

```
Manager (로컬):
  ItemReader.read() → 청크를 메시지로 전송 →┐
                                           ↓
Worker (원격):                    [MessageChannel]
  ← 청크 수신 ← ItemProcessor + ItemWriter 실행
```

> ⚠️ 메시지 유실 방지를 위해 내구성 있는 메시지 채널(JMS, AMQP 등) 필요.
> 네트워크 오버헤드가 있어 처리 부하가 I/O보다 월등히 클 때 효과적이다.

---

## 전략 선택 가이드

```
단일 머신으로 처리 가능?
  ├─ YES → 여러 독립 Step인가?
  │         ├─ YES → Parallel Steps
  │         └─ NO  → 대용량 단일 데이터셋인가?
  │                   ├─ YES → Partitioning
  │                   └─ NO  → Multi-threaded Step
  └─ NO → 처리 부하가 읽기보다 훨씬 큰가?
            ├─ YES → Remote Chunking
            └─ NO  → Partitioning (원격 PartitionHandler)
```

---

## 관련 페이지

- [[spring-batch/chunk-processing]] — 기본 청크 처리
- [[spring-batch/architecture]] — 아키텍처 전체 구조
