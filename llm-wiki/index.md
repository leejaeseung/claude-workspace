# LLM Wiki — 인덱스

> 최종 갱신: 2026-04-21

---

## 위키 구조

```
llm-wiki/
├── raw/                  # 원본 자료 (불변, 읽기 전용)
├── wiki/
│   ├── concepts/         # Wiki 운영 개념
│   └── spring/           # Spring 생태계
│       └── spring-batch/ # Spring Batch 상세
├── index.md              # 이 파일 — 전체 카탈로그
└── log.md                # 처리 기록
```

---

## Spring 위키

| 페이지 | 설명 |
|--------|------|
| [[wiki/spring/spring-overview]] | Spring 생태계 전체 개요 |
| [[wiki/spring/spring-batch/overview]] | Spring Batch 개요 및 사용 시나리오 |
| [[wiki/spring/spring-batch/architecture]] | 아키텍처, 3계층 구조, 실행 흐름 |
| [[wiki/spring/spring-batch/domain-language]] | Job/Step/JobInstance/ExecutionContext 등 도메인 객체 |
| [[wiki/spring/spring-batch/chunk-processing]] | Chunk 처리, Skip/Retry, Tasklet |
| [[wiki/spring/spring-batch/scaling]] | Multi-thread, Partitioning, Remote Chunking |

---

## LLM Wiki 방법론

| 페이지 | 설명 |
|--------|------|
| [[wiki/llm-wiki-methodology]] | LLM Wiki 방법론 전체 개요 |
| [[wiki/concepts/knowledge-accumulation]] | 지식 축적 원칙 |
| [[wiki/concepts/schema-rules]] | Schema 규칙 작성법 |
| [[wiki/concepts/raw-sources]] | 원본 자료 관리 원칙 |

---

## 원본 자료 목록

| 파일 | 주제 | 수집일 |
|------|------|--------|
| [[raw/karpathy-llm-wiki-2026]] | Andrej Karpathy의 LLM Wiki 방법론 | 2026-04-21 |
| [[raw/spring-batch-official-docs-2026]] | Spring Batch 공식 문서 (v6.0.3) | 2026-04-21 |

---

## 태그 인덱스

- `#spring` → [[wiki/spring/spring-overview]]
- `#spring-batch` → [[wiki/spring/spring-batch/overview]], [[wiki/spring/spring-batch/architecture]]
- `#chunk-processing` → [[wiki/spring/spring-batch/chunk-processing]]
- `#batch-scaling` → [[wiki/spring/spring-batch/scaling]]
- `#llm-활용` → [[wiki/llm-wiki-methodology]]
- `#지식관리` → [[wiki/concepts/knowledge-accumulation]]
- `#wiki-운영` → [[wiki/concepts/schema-rules]], [[wiki/concepts/raw-sources]]
