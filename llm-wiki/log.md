# Wiki 처리 로그

---

## 2026-04-21

### 초기 구성
- 위키 구조 생성 (raw/, wiki/, concepts/)
- CLAUDE.md에 위키 운영 규칙 추가

### 자료 입력
- `raw/karpathy-llm-wiki-2026.md` 추가
  - 출처: https://javaexpert.tistory.com/1709
  - 원본 Gist: Andrej Karpathy

### 생성된 위키 페이지
- `wiki/llm-wiki-methodology.md` — LLM Wiki 방법론 개요
- `wiki/concepts/knowledge-accumulation.md` — 지식 축적 원칙
- `wiki/concepts/schema-rules.md` — Schema 규칙 작성법
- `wiki/concepts/raw-sources.md` — 원본 자료 관리 원칙

### 갱신된 파일
- `index.md` — 초기 카탈로그 구성

---

### Spring Batch 학습 및 위키 구성
- 출처: https://docs.spring.io/spring-batch/reference/index.html
- 출처: https://spring.io/projects/spring-batch

### 자료 입력
- `raw/spring-batch-official-docs-2026.md` 추가
  - Spring Batch 공식 문서 (v6.0.3) 핵심 내용 수집

### 생성된 위키 페이지
- `wiki/spring/spring-overview.md` — Spring 생태계 전체 개요
- `wiki/spring/spring-batch/overview.md` — Spring Batch 개요, 사용 시나리오
- `wiki/spring/spring-batch/architecture.md` — 3계층 구조, 실행 흐름, 메타데이터 테이블
- `wiki/spring/spring-batch/domain-language.md` — Job/JobInstance/JobExecution/StepExecution/ExecutionContext
- `wiki/spring/spring-batch/chunk-processing.md` — Chunk 처리, Skip/Retry, Tasklet
- `wiki/spring/spring-batch/scaling.md` — Multi-thread/Parallel/Partitioning/Remote Chunking

### 갱신된 파일
- `index.md` — Spring 위키 섹션 및 태그 인덱스 추가

---

## 2026-04-25

### Kotlin Coroutines — Coroutine Stream Broadcast 조사

- 출처: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/
- 출처: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/
- 출처: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/share-in.html
- 출처: https://kotlinlang.org/docs/channels.html

### 자료 입력
- `raw/kotlin-coroutines-flow-official-2026.md` 추가
  - SharedFlow, StateFlow, shareIn, Channel 공식 문서 원본

### 생성된 위키 페이지
- `wiki/kotlin/coroutine-stream-broadcast.md`
  - Cold vs Hot Stream 개념
  - SharedFlow (broadcast 패턴, replay, buffer, event bus)
  - StateFlow (상태 공유, conflation)
  - SharedFlow vs StateFlow 선택 기준
  - shareIn / stateIn (Cold → Hot 변환, SharingStarted 옵션)
  - Channel Fan-out / Fan-in / Pipeline 패턴
  - BroadcastChannel 마이그레이션 가이드

### 갱신된 파일
- `index.md` — Kotlin 위키 섹션, 원본 목록, 태그 인덱스 추가

---

### Broadcast Stream Subscriber 중단/재개 조사

- 출처: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-shared-flow/
- 출처: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-companion/-while-subscribed.html
- 출처: https://kotlinlang.org/docs/flow.html (buffer, conflate, collectLatest 섹션)

### 생성된 위키 페이지
- `wiki/kotlin/coroutine-subscriber-pause-resume.md`
  - Flow에 "일시 정지" API가 없다는 사실 명시
  - 두 가지 중단 방식: Slow Collect(backpressure) vs Cancel & Resubscribe
  - replay 설정별 재구독 시 수신 가능 값 범위
  - WhileSubscribed의 stopTimeoutMillis / replayExpirationMillis 동작
  - buffer / conflate / collectLatest 전략 비교
  - Channel vs SharedFlow 재구독 비교
  - 상황별 패턴 정리 (5가지 시나리오)

### 갱신된 파일
- `wiki/kotlin/coroutine-stream-broadcast.md` — 관련 페이지 링크 추가
- `index.md` — 신규 페이지 등록, 태그 4개 추가
