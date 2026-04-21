# 원본: Spring Batch 공식 문서

- 출처: https://docs.spring.io/spring-batch/reference/index.html
- 출처2: https://spring.io/projects/spring-batch
- 수집일: 2026-04-21
- 분류: Spring / Batch Processing
- 최신 버전: 6.0.3

---

## 정의
Spring Batch는 엔터프라이즈 시스템의 일일 운영에 필수적인 강력한 배치 애플리케이션 개발을 위한 경량의 종합적인 배치 프레임워크.

## 아키텍처 3계층
- Application Layer: 배치 애플리케이션 로직
- Batch Core Layer: Job, Step, JobLauncher 등
- Infrastructure Layer: JobRepository, JobOperator 등

## 핵심 컴포넌트

### Job
- 전체 배치 프로세스를 캡슐화하는 최상위 엔티티
- Step들의 순차/조건부 실행 정의
- JobRepository에 의해 메타데이터 관리

### Step
- Job의 독립적인 실행 단위
- Chunk-oriented Step: ItemReader → ItemProcessor → ItemWriter
- Tasklet Step: 단순 작업 실행

### JobInstance
- 논리적 작업 실행 = Job + identifying JobParameters
- 같은 JobInstance는 동시에 2개 이상 실행 불가

### JobExecution
- Job을 실행하는 단일 시도
- 속성: Status, startTime, endTime, exitStatus, executionContext, failureExceptions

### StepExecution
- Step을 실행하는 단일 시도
- 속성: readCount, writeCount, commitCount, rollbackCount, readSkipCount, writeSkipCount, filterCount

### ExecutionContext
- key/value 쌍 컬렉션
- Step 범위: 각 commit point마다 저장
- Job 범위: 각 Step 실행 사이에 저장
- 모든 항목은 Serializable이어야 함

### JobParameters
- JobInstance 식별에 사용
- 실행 중 참조 데이터로도 사용

### ItemReader
- FlatFileItemReader, StaxEventItemReader, JsonItemReader
- JdbcCursorItemReader, JdbcPagingItemReader
- 종료 시 null 반환

### ItemProcessor
- 선택적 컴포넌트
- null 반환 시 해당 아이템 필터링
- 입력 타입 → 출력 타입 변환 가능

### ItemWriter
- FlatFileItemWriter, JdbcBatchItemWriter, HibernateItemWriter
- 청크 단위 일괄 기록

### JobLauncher
- Job과 JobParameters를 받아 실행
- JobExecution 반환
- 동기/비동기 실행 지원

### JobRepository
- 모든 메타데이터 영속성 관리
- 관리 테이블: BATCH_JOB_INSTANCE, BATCH_JOB_EXECUTION, BATCH_STEP_EXECUTION, *_CONTEXT

## Chunk-Oriented Processing 상세
```
Transaction Begin
  for i = 0; i < commitInterval; i++:
    item = ItemReader.read()
    processedItem = ItemProcessor.process(item)
    buffer.add(processedItem)
  ItemWriter.write(buffer)
Transaction Commit
```

## 확장 전략
1. Multi-threaded Step: 단일 Step 병렬 실행 (TaskExecutor)
2. Parallel Steps: 여러 Step 동시 실행
3. Remote Chunking: 읽기는 로컬, 처리/쓰기는 원격
4. Partitioning: 데이터 분할 후 병렬 처리 (Partitioner + PartitionHandler)

## Skip/Retry
- Skip: 특정 예외 시 해당 아이템 건너뛰고 계속 처리
- Retry: 실패 아이템 재시도 (Backoff policy 지원)

## 메타데이터 테이블
- BATCH_JOB_INSTANCE
- BATCH_JOB_EXECUTION
- BATCH_STEP_EXECUTION
- BATCH_JOB_EXECUTION_CONTEXT
- BATCH_STEP_EXECUTION_CONTEXT

## 모니터링
- Micrometer: 메트릭 수집 (실행 시간, 처리 아이템 수)
- Java Flight Recorder: 저수준 성능 분석

## 주의사항
- XML 네임스페이스는 6.0부터 deprecated, 7.0에서 제거 예정
- Java 설정 권장
