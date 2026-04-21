# Spring Batch Chunk 기반 처리

> 관련 원본: [[raw/spring-batch-official-docs-2026]]
> 관련 페이지: [[spring-batch/domain-language]]
> 최초 작성: 2026-04-21

---

## 핵심 개념

Chunk-Oriented Processing은 Spring Batch의 가장 일반적인 Step 처리 방식이다.
데이터를 **한 번에 하나씩 읽고**, **설정된 청크 크기(commit interval)만큼 모아서** 일괄 쓰기한다.

**이점**: 개별 아이템마다 트랜잭션을 열지 않아 성능 최적화, 실패 시 청크 단위 롤백으로 안전성 확보.

---

## 처리 흐름

```
[트랜잭션 시작]
  for i in range(commitInterval):
      item = ItemReader.read()          ① 하나씩 읽기
      if item is None: break
      result = ItemProcessor.process(item)  ② 변환/필터 (선택)
      if result is not None:
          buffer.append(result)
  ItemWriter.write(buffer)              ③ 청크 단위 일괄 쓰기
[트랜잭션 커밋]
[ExecutionContext 저장]
```

**ItemProcessor가 null을 반환하면** 해당 아이템은 buffer에 추가되지 않아 쓰기 대상에서 제외된다 (필터링).

---

## Step 설정 예시

```java
@Bean
public Step chunkStep(JobRepository jobRepository,
                      PlatformTransactionManager transactionManager) {
    return new StepBuilder("chunkStep", jobRepository)
        .<InputType, OutputType>chunk(100, transactionManager)  // commit-interval = 100
        .reader(itemReader())
        .processor(itemProcessor())   // 선택사항
        .writer(itemWriter())
        .build();
}
```

---

## Commit Interval (청크 크기) 설정

| 값 | 효과 |
|----|------|
| **너무 작음** (예: 1) | 트랜잭션 오버헤드 증가, 성능 저하 |
| **너무 큼** (예: 100,000) | 실패 시 많은 데이터 롤백, 메모리 부담 |
| **권장** | 수백~수천 (데이터 크기와 처리 시간에 따라 조정) |

---

## Skip 처리

특정 예외 발생 시 해당 아이템을 건너뛰고 처리를 계속한다.

```java
.chunk(100, transactionManager)
.reader(reader())
.writer(writer())
.faultTolerant()
    .skip(FlatFileParseException.class)  // 이 예외는 skip
    .skipLimit(10)                       // 최대 10개까지 skip 허용
.build()
```

**Skip 동작 원리**:
- 청크 내 아이템이 skip 예외 발생 → 해당 청크를 아이템 하나씩 재처리
- 문제 아이템만 skip 처리, 나머지는 정상 커밋

---

## Retry 처리

일시적 실패(네트워크 오류 등)에 대해 재시도한다.

```java
.faultTolerant()
    .retry(DeadlockLoserDataAccessException.class)
    .retryLimit(3)          // 최대 3회 재시도
.build()
```

**Backoff Policy 예시**:
```java
.faultTolerant()
    .retry(Exception.class)
    .retryLimit(5)
    .backOffPolicy(new ExponentialBackOffPolicy())  // 지수 백오프
.build()
```

---

## Skip vs Retry 비교

| 구분 | Skip | Retry |
|------|------|-------|
| 목적 | 불량 데이터 무시 | 일시적 실패 재시도 |
| 대상 | 데이터 파싱 오류, 검증 실패 | 네트워크 타임아웃, 데드락 |
| 결과 | 해당 아이템 처리 생략 | 성공할 때까지 재시도 |
| 한도 | `skipLimit` | `retryLimit` |

---

## Tasklet Step (Chunk 대안)

단순 작업(파일 삭제, 프로시저 호출 등)에 사용한다.

```java
@Bean
public Step deleteFileStep(JobRepository jobRepository,
                           PlatformTransactionManager transactionManager) {
    return new StepBuilder("deleteFileStep", jobRepository)
        .tasklet((contribution, chunkContext) -> {
            // 단순 작업 수행
            Files.delete(Path.of("/tmp/input.csv"));
            return RepeatStatus.FINISHED;  // 완료
        }, transactionManager)
        .build();
}
```

**`RepeatStatus.CONTINUABLE`**: 다시 호출
**`RepeatStatus.FINISHED`**: 완료, 다음 Step으로

---

## 트랜잭션 속성 설정

```java
DefaultTransactionAttribute attr = new DefaultTransactionAttribute();
attr.setPropagationBehavior(Propagation.REQUIRED.value());
attr.setIsolationLevel(Isolation.DEFAULT.value());
attr.setTimeout(30);  // 30초 타임아웃

.chunk(100, transactionManager)
.transactionAttribute(attr)
```

---

## ItemStream 인터페이스 (재시작 지원)

```java
public interface ItemStream {
    void open(ExecutionContext executionContext);    // 초기화, 상태 복구
    void update(ExecutionContext executionContext);  // 매 커밋 후 상태 저장
    void close();                                   // 자원 해제
}
```

Spring Batch 기본 제공 Reader/Writer는 대부분 ItemStream을 구현한다.
커스텀 Reader/Writer 작성 시 재시작 지원이 필요하면 ItemStream을 함께 구현해야 한다.

---

## 관련 페이지

- [[spring-batch/domain-language]] — ExecutionContext, ItemReader/Writer 상세
- [[spring-batch/scaling]] — 병렬 청크 처리
