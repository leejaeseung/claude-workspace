# Spring Batch 도메인 언어

> 관련 원본: [[raw/spring-batch-official-docs-2026]]
> 관련 페이지: [[spring-batch/architecture]]
> 최초 작성: 2026-04-21

---

## 도메인 객체 관계도

```
Job (1)
 └── JobInstance (N)  ← Job + JobParameters 조합
       └── JobExecution (N)  ← 각 실행 시도
             ├── JobExecutionContext
             └── StepExecution (N)  ← 각 Step 실행
                   └── StepExecutionContext
```

---

## Job

```java
@Bean
public Job footballJob(JobRepository jobRepository) {
    return new JobBuilder("footballJob", jobRepository)
        .start(playerLoad())
        .next(gameLoad())
        .next(playerSummarization())
        .build();
}
```

**주요 속성**:
- 이름 (고유 식별자)
- Step 목록 및 실행 순서
- `restartable` — 재시작 허용 여부

---

## JobInstance

**정의**: 논리적 Job 실행 단위

```
JobInstance = Job + identifying JobParameters
```

**예시**:
- `EndOfDayJob` + `date=2026-01-01` → JobInstance #1
- `EndOfDayJob` + `date=2026-01-02` → JobInstance #2

**특징**:
- 같은 JobInstance는 동시에 2개 이상 실행 불가
- JobExecution이 COMPLETED 상태면 같은 JobInstance 재실행 불가

---

## JobParameters

**정의**: Job 실행 시 전달되는 파라미터 세트

**역할**:
1. JobInstance 식별 (identifying parameter)
2. 실행 중 참조 데이터

```java
JobParameters params = new JobParametersBuilder()
    .addLocalDate("date", LocalDate.now())
    .addString("inputFile", "data.csv")
    .toJobParameters();
```

> ⚠️ 파라미터가 다르면 항상 새 JobInstance가 생성된다.
> 같은 Job을 매번 새로 실행하려면 타임스탬프 파라미터를 추가하는 패턴이 일반적이다.

---

## JobExecution

**정의**: Job의 단일 실행 시도 (기술적 개념)

**상태 (BatchStatus)**:
- `STARTING` → `STARTED` → `COMPLETED` / `FAILED` / `STOPPED` / `ABANDONED`

**주요 속성**:

| 속성 | 타입 | 설명 |
|------|------|------|
| `status` | BatchStatus | 현재 실행 상태 |
| `startTime` | LocalDateTime | 실행 시작 시각 |
| `endTime` | LocalDateTime | 실행 종료 시각 |
| `exitStatus` | ExitStatus | 호출자에게 반환되는 종료 코드 |
| `executionContext` | ExecutionContext | 재시작용 상태 저장 |
| `failureExceptions` | List<Throwable> | 발생한 예외 목록 |

**재시작 예시**:
```
실행 #1: date=01-01, status=FAILED   → JobExecution ID:1
실행 #2: date=01-01, status=COMPLETED → JobExecution ID:2
→ 두 실행 모두 같은 JobInstance에 속함
```

---

## StepExecution

**정의**: Step의 단일 실행 시도

**특징**:
- Step이 실제로 시작될 때만 생성
- 이전 Step이 실패하면 이 Step의 StepExecution은 생성되지 않음

**주요 속성**:

| 속성 | 설명 |
|------|------|
| `readCount` | 성공적으로 읽은 아이템 수 |
| `writeCount` | 성공적으로 쓴 아이템 수 |
| `commitCount` | 커밋된 트랜잭션 수 |
| `rollbackCount` | 롤백 횟수 |
| `readSkipCount` | 읽기 중 Skip된 아이템 수 |
| `processSkipCount` | 처리 중 Skip된 아이템 수 |
| `writeSkipCount` | 쓰기 중 Skip된 아이템 수 |
| `filterCount` | ItemProcessor가 null 반환으로 필터링한 수 |

---

## ExecutionContext

**정의**: 실행 상태를 저장하는 key/value 컨테이너

**범위**:
- **Step ExecutionContext**: 각 commit point마다 저장 → Step 재시작 지원
- **Job ExecutionContext**: 각 Step 완료 사이에 저장 → Step 간 데이터 공유

```java
// 상태 저장 (ItemStream.update 내부)
executionContext.putLong("lines.read.count", reader.getPosition());

// 재시작 시 복구 (ItemStream.open 내부)
if (executionContext.containsKey("lines.read.count")) {
    long lineCount = executionContext.getLong("lines.read.count");
    // lineCount 위치부터 재개
}
```

> ⚠️ ExecutionContext에 저장되는 객체는 반드시 `Serializable`이어야 한다.

---

## ItemReader / ItemProcessor / ItemWriter

| 컴포넌트 | 인터페이스 핵심 메서드 | 특이사항 |
|---------|----------------------|---------|
| **ItemReader** | `T read()` | 읽을 항목 없으면 `null` 반환 |
| **ItemProcessor** | `O process(I item)` | `null` 반환 시 해당 아이템 필터링 |
| **ItemWriter** | `void write(Chunk<? extends O> chunk)` | 청크 단위 일괄 처리 |

**주요 구현체**:

**ItemReader**:
- `FlatFileItemReader` — CSV/텍스트
- `JdbcCursorItemReader` — DB 커서 방식 (대용량에 유의)
- `JdbcPagingItemReader` — DB 페이징 방식 (재시작 안전)
- `JsonItemReader` — JSON 배열
- `StaxEventItemReader` — XML

**ItemWriter**:
- `FlatFileItemWriter` — 파일 출력
- `JdbcBatchItemWriter` — DB 배치 Insert/Update
- `JpaItemWriter` — JPA 엔티티 저장

---

## 관련 페이지

- [[spring-batch/architecture]] — 아키텍처 구조
- [[spring-batch/chunk-processing]] — Chunk 처리에서 도메인 객체 활용
