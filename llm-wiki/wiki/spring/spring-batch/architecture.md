# Spring Batch 아키텍처

> 관련 원본: [[raw/spring-batch-official-docs-2026]]
> 관련 페이지: [[spring-batch/overview]]
> 최초 작성: 2026-04-21

---

## 3계층 구조

```
┌──────────────────────────────────┐
│       Application Layer          │  ← 개발자가 작성하는 Job, Step, 비즈니스 로직
├──────────────────────────────────┤
│       Batch Core Layer           │  ← Job, Step, JobLauncher, JobParameters
├──────────────────────────────────┤
│     Infrastructure Layer         │  ← JobRepository, JobOperator, ItemReader/Writer
└──────────────────────────────────┘
```

---

## 런타임 아키텍처

```
                   JobLauncher
                       │
                  run(job, params)
                       │
                       ▼
              ┌─────── Job ────────┐
              │  Step 1            │
              │  Step 2            │
              │  Step N            │
              └────────────────────┘
                       │
                  결과 저장
                       │
                       ▼
                 JobRepository
              (BATCH_* 메타 테이블)
```

---

## 실행 흐름 (순서)

```
1. JobLauncher.run(job, jobParameters) 호출
   ↓
2. JobRepository에서 JobInstance 조회 또는 생성
   ↓
3. JobExecution 생성 및 저장
   ↓
4. 각 Step 순차 실행
   ├─ StepExecution 생성
   ├─ ItemStream.open()
   ├─ [Chunk 반복]
   │    ├─ Transaction Begin
   │    ├─ ItemReader.read() × commitInterval
   │    ├─ ItemProcessor.process() (선택)
   │    ├─ ItemWriter.write(chunk)
   │    ├─ Transaction Commit
   │    └─ ItemStream.update() → ExecutionContext 저장
   └─ Step 완료 → StepExecution 저장
   ↓
5. Job 완료 → JobExecution 최종 저장
```

---

## 핵심 컴포넌트 역할 요약

| 컴포넌트 | 계층 | 역할 |
|---------|------|------|
| **Job** | Core | 배치 작업 전체 캡슐화 |
| **Step** | Core | 독립적 처리 단위 |
| **JobLauncher** | Core | Job 실행 트리거 |
| **JobParameters** | Core | Job 실행 식별 파라미터 |
| **ItemReader** | Infrastructure | 데이터 소스에서 읽기 |
| **ItemProcessor** | Infrastructure | 비즈니스 변환/필터 |
| **ItemWriter** | Infrastructure | 대상 저장소에 쓰기 |
| **JobRepository** | Infrastructure | 메타데이터 영속성 |
| **JobOperator** | Infrastructure | 운영 제어 (중지/재시작) |
| **ExecutionContext** | Infrastructure | 상태 저장 (재시작 지원) |

---

## 메타데이터 테이블 구조

```
BATCH_JOB_INSTANCE          ← JobInstance (논리 실행 단위)
  └── BATCH_JOB_EXECUTION   ← JobExecution (실제 실행 시도)
        ├── BATCH_JOB_EXECUTION_CONTEXT
        └── BATCH_STEP_EXECUTION      ← StepExecution
              └── BATCH_STEP_EXECUTION_CONTEXT
```

**각 테이블 역할**:
- `BATCH_JOB_INSTANCE`: Job + JobParameters로 식별되는 논리 단위
- `BATCH_JOB_EXECUTION`: 각 실행 시도 (실패 후 재실행 시 새 행 생성)
- `BATCH_STEP_EXECUTION`: Step별 읽기/쓰기/Skip 횟수 등 상세 통계
- `*_CONTEXT`: 재시작 시 복구할 상태 직렬화 저장

---

## Step 타입

### 1. Chunk-Oriented Step (가장 일반적)
```
Reader → (Processor) → Writer
청크 단위 트랜잭션 처리
```
→ 상세 내용: [[spring-batch/chunk-processing]]

### 2. Tasklet Step
```
단일 Tasklet.execute() 호출
트랜잭션 내에서 반복 실행 가능
RepeatStatus.FINISHED 반환 시 완료
```
→ 파일 삭제, 프로시저 호출 등 단순 작업에 적합

---

## 관련 페이지

- [[spring-batch/domain-language]] — 도메인 객체 상세
- [[spring-batch/chunk-processing]] — Chunk 처리 상세
- [[spring-batch/scaling]] — 확장 전략
