# ERD to API

Mermaid ERD 다이어그램으로부터 즉시 실행 가능한 REST API CRUD 프로젝트를 생성하고,  
반대로 **기존 프로젝트 코드를 ERD 다이어그램으로 역변환**하는 양방향 도구입니다.

**Web UI**에서 다이어그램을 직접 그리거나, **CLI**로 `.mmd` 파일을 입력하면 선택한 언어의 완전한 프로젝트 구조를 생성합니다.  
이 도구로 생성된 Python / Java / Kotlin 프로젝트 ZIP을 업로드하면 ERD 다이어그램으로 복원됩니다.

---

## 목차

1. [개요](#개요)
2. [전체 파이프라인](#전체-파이프라인)
3. [레이어별 상세 설명](#레이어별-상세-설명)
   - [1. 입력: Mermaid ERD](#1-입력-mermaid-erd)
   - [2. 파서](#2-파서-srcparsermermaidpy)
   - [3. IR (중간 표현)](#3-ir-중간-표현-srcirmodelspy)
   - [4. 제너레이터](#4-제너레이터-srcgenerators)
   - [5. LLM 보강](#5-llm-보강-srcllmenhancerpy)
   - [6. 역방향 파서](#6-역방향-파서-srcreverse)
   - [7. Web UI](#7-web-ui-web)
   - [8. API 서버](#8-api-서버-serverpy)
4. [언어별 기술 스택](#언어별-기술-스택)
5. [생성 결과물 구조](#생성-결과물-구조)
6. [설치 및 실행](#설치-및-실행)
7. [사용법](#사용법)
   - [CLI](#cli-사용법)
   - [Web UI](#web-ui-사용법)
8. [프로젝트 파일 구조](#프로젝트-파일-구조)
9. [설계 원칙과 제약사항](#설계-원칙과-제약사항)
10. [확장 가이드](#확장-가이드)

---

## 개요

### 핵심 목표

> **"다이어그램을 그리면 코드가 나온다"**

사용자가 엔티티-관계 다이어그램(ERD)을 작성하면, 도구가 그것을 분석하여 즉시 실행 가능한 REST API CRUD 애플리케이션을 생성합니다.

### 지원 언어

| 언어 | 프레임워크 | 상태 |
|------|-----------|------|
| Python | FastAPI + SQLAlchemy 2.0 + Pydantic v2 | ✅ 완전 검증 (smoke test 통과) |
| Java | Spring Boot 3.3 + Spring Data JPA + Lombok | ✅ 템플릿 생성 완료 (JDK 필요) |
| Kotlin | Spring Boot 3.3 + Spring Data JPA + Kotlin DSL | ✅ 템플릿 생성 완료 (JDK 필요) |

### 두 가지 진입점

```
[Web UI]  브라우저에서 그래픽으로 ERD 작성 → ZIP 다운로드
[CLI]     .mmd 파일 → python3 main.py generate → 프로젝트 디렉토리 생성
```

---

## 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│                         입력 레이어                              │
│  Web UI (ReactFlow 캔버스)  /  CLI (.mmd 파일)                  │
└───────────────────┬─────────────────────────────────────────────┘
                    │ Mermaid ERD 텍스트
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         파서 레이어                              │
│  src/parser/mermaid.py                                          │
│  • 엔티티 블록 파싱 (이름, 필드, 태그)                           │
│  • 관계 라인 파싱 (방향, 카디널리티, 라벨)                       │
└───────────────────┬─────────────────────────────────────────────┘
                    │ ERDiagram (IR 객체)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      IR (중간 표현) 레이어                        │
│  src/ir/models.py                                               │
│  • IRField: 필드 정보 + 언어별 타입 변환 프로퍼티                 │
│  • IREntity: 엔티티 정보 + 이름 변환 유틸리티                     │
│  • IRRelation: 관계 정보                                         │
│  • ERDiagram: 전체 다이어그램 컨테이너                            │
└───────────────────┬─────────────────────────────────────────────┘
                    │ ERDiagram
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      제너레이터 레이어                            │
│  src/generators/{python,java,kotlin}/generator.py               │
│  Jinja2 템플릿 + ERDiagram → 프로젝트 파일 트리                  │
└──────────────┬────────────────────┬────────────────────────────┘
               │                    │ (선택적)
               │               ┌────▼───────────────┐
               │               │   LLM 보강 레이어   │
               │               │  src/llm/enhancer  │
               │               │  Claude API 호출   │
               │               └────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       출력                                       │
│  CLI: 로컬 디렉토리에 프로젝트 파일 생성                          │
│  Web UI: ZIP 파일 다운로드                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 레이어별 상세 설명

### 1. 입력: Mermaid ERD

도구의 유일한 입력 포맷은 [Mermaid ERD 문법](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)입니다.

**문법 예시** (`examples/blog.mmd`):

```
erDiagram
    User {
        int id PK
        string email
        string password
        string name
        datetime created_at
    }
    Post {
        int id PK
        string title
        text content
        int user_id FK
        datetime created_at
    }
    User ||--o{ Post : "writes"
```

**지원하는 필드 타입:**

| Mermaid 타입 | Python | Java/Kotlin | SQL |
|-------------|--------|-------------|-----|
| `int`, `integer`, `bigint`, `long` | `int` | `Long` | `BIGINT` |
| `string`, `varchar`, `char` | `str` | `String` | `VARCHAR(255)` |
| `text` | `str` | `String` | `TEXT` |
| `float`, `double`, `decimal` | `float` | `Double` | `DECIMAL(19,4)` |
| `boolean`, `bool` | `bool` | `Boolean` | `BOOLEAN` |
| `datetime`, `timestamp` | `datetime` | `LocalDateTime` | `TIMESTAMP` |
| `date` | `date` | `LocalDate` | `DATE` |

**지원하는 관계 카디널리티:**

| Mermaid 표기 | 의미 | 생성 방식 |
|-------------|------|---------|
| `\|\|--o{` | 일대다 (1:N) | FK 컬럼 + ORM relationship |
| `\|\|--\|\|` | 일대일 (1:1) | FK 컬럼 + ORM relationship |
| `}o--o{` | 다대다 (N:M) | 관계만 표시 (조인 테이블은 미지원) |

**중요 제약:**
- 모든 관계 라인에는 반드시 `: "label"` 부분이 있어야 합니다. (파서 regex 요구사항)
- 관계 방향: `from` = one-side, `to` = many-side
- 1:N 관계에서 FK 필드(`user_id FK`)는 명시적으로 선언하거나, Web UI 사용 시 자동 삽입됩니다.

---

### 2. 파서 (`src/parser/mermaid.py`)

Mermaid ERD 텍스트를 분석하여 IR 객체로 변환합니다.

**파싱 과정:**

```
1. 줄 단위로 분리
2. 엔티티 블록 탐지: r"^([A-Za-z_]\w*)\s*\{"
3. 필드 파싱: "타입 이름 [PK] [FK] [UK]"
4. 관계 파싱: r"^(\w+)\s+([|o}{]+)--([|o}{]+)\s+(\w+)\s*:\s*..."
5. 카디널리티 판단: 마커 문자({, }, o)로 many-side 탐지
```

**카디널리티 판정 로직:**

```python
def _parse_relation_type(left: str, right: str) -> RelationType:
    left_many  = any(m in left  for m in ["{", "}", "o{", "}o"])
    right_many = any(m in right for m in ["{", "}", "o{", "}o"])

    if left_many and right_many:  return MANY_TO_MANY
    if right_many:                return ONE_TO_MANY
    if left_many:                 return MANY_TO_ONE
    return ONE_TO_ONE
```

**주석 처리:** `%%` 로 시작하는 라인은 무시됩니다.

---

### 3. IR (중간 표현) (`src/ir/models.py`)

파서와 제너레이터 사이의 언어 중립적 데이터 모델입니다.  
IR을 설계의 핵심에 두기 때문에, 새로운 언어 지원을 추가할 때 파서를 건드릴 필요가 없습니다.

**클래스 구조:**

```
ERDiagram
├── entities: List[IREntity]
│   ├── name: str
│   ├── fields: List[IRField]
│   │   ├── name, type: FieldType
│   │   ├── primary_key, foreign_key, nullable, unique: bool
│   │   └── 프로퍼티: python_type, sa_type, java_type, kotlin_type, java_imports
│   └── 프로퍼티: name_snake, name_plural_snake, name_lower, pk_field, non_pk_fields
└── relations: List[IRRelation]
    ├── from_entity, to_entity: str
    ├── type: RelationType
    └── label: str
```

**타입 변환 예시** (`IRField` 프로퍼티):

```python
field = IRField(name="created_at", type=FieldType.DATETIME)

field.python_type   # → "datetime"
field.sa_type       # → "DateTime"        (SQLAlchemy)
field.java_type     # → "LocalDateTime"   (Java/Kotlin)
field.java_imports  # → ["java.time.LocalDateTime"]
```

**이름 변환 예시** (`IREntity` 프로퍼티):

```python
entity = IREntity(name="UserProfile")

entity.name_snake        # → "user_profile"
entity.name_plural_snake # → "user_profiles"
entity.name_lower        # → "userProfile"
entity.name_plural_lower # → "userProfiles"
```

---

### 4. 제너레이터 (`src/generators/`)

IR을 받아 Jinja2 템플릿으로 실제 파일을 생성합니다.

**구조:**

```
src/generators/
├── base.py                  # BaseGenerator 추상 클래스
├── python/
│   ├── generator.py         # PythonGenerator
│   └── templates/
│       ├── main.py.j2       # FastAPI 앱 진입점
│       ├── database.py.j2   # SQLAlchemy 엔진/세션
│       ├── model.py.j2      # SQLAlchemy 모델 (엔티티당 1개)
│       ├── schema.py.j2     # Pydantic 스키마 (엔티티당 1개)
│       ├── router.py.j2     # FastAPI 라우터 (엔티티당 1개)
│       ├── alembic.ini.j2   # Alembic 설정
│       ├── alembic_env.py.j2
│       ├── requirements.txt.j2
│       ├── docker-compose.yml.j2
│       └── env.j2
├── java/
│   ├── generator.py         # JavaGenerator
│   └── templates/
│       ├── Application.java.j2
│       ├── Entity.java.j2
│       ├── Repository.java.j2
│       ├── Service.java.j2
│       ├── Controller.java.j2
│       ├── CreateDto.java.j2
│       ├── UpdateDto.java.j2
│       ├── ResponseDto.java.j2
│       ├── pom.xml.j2
│       ├── application.yml.j2
│       ├── migration.sql.j2
│       └── docker-compose.yml.j2
└── kotlin/                  # Java와 동일 구조, Kotlin 문법
```

**BaseGenerator 계약:**

```python
class BaseGenerator(ABC):
    def __init__(self, template_dir: Path):
        self.env = Environment(loader=FileSystemLoader(...))

    def render(self, template_name: str, **ctx) -> str: ...
    def write(self, path: Path, content: str) -> None: ...

    @abstractmethod
    def generate(self, diagram: ERDiagram, project_name: str, output_dir: Path) -> None: ...
```

**관계 처리 설계:**

SQLAlchemy의 `relationship()`에서 양방향 선언(`back_populates`) 대신 단방향 `backref`를 사용합니다. `from_entity`(one-side)에서만 관계를 선언하면 SQLAlchemy가 반대쪽 역참조를 자동 생성합니다.

```python
# User 모델 (one-side, relations_for("User") 반환)
posts = relationship("Post", backref="user", lazy="select")

# Post 모델에는 명시적 선언 없음 → backref로 post.user 자동 생성
```

---

### 6. 역방향 파서 (`src/reverse/`)

기존 프로젝트 코드를 읽어 ERDiagram IR로 역변환합니다.

**파일 구조:**

```
src/reverse/
├── detector.py        # 언어 자동 탐지 + 파서 선택
├── mermaid_writer.py  # ERDiagram → Mermaid 텍스트
├── python_parser.py   # SQLAlchemy 모델 → ERDiagram
├── java_parser.py     # JPA 엔티티(Java) → ERDiagram
└── kotlin_parser.py   # JPA 엔티티(Kotlin) → ERDiagram
```

**언어 자동 탐지 규칙:**

| 조건 | 탐지 언어 |
|------|---------|
| `app/models/` 디렉토리 존재 | Python |
| `entity/*.kt` 파일 존재 | Kotlin |
| `entity/*.java` 파일 존재 | Java |

**관계 추론 전략 (FK 컬럼 단독 사용):**

`relationship()` / `@OneToMany` 라인은 사용하지 않습니다 — FK 컬럼만으로 추론하면 중복 없이 완전한 관계를 복원할 수 있습니다.

```
Python: user_id = Column(Integer, ForeignKey("users.id"))
  → 필드명 "user_id" → base "user" → 엔티티 "User" 탐색 → User ||--o{ ThisEntity

Java/Kotlin: private Long user_id  (ForeignKey 명시 없음)
  → 필드명 패턴 "_id" → base "user" → 엔티티 "User" 탐색 → User ||--o{ ThisEntity
```

**알려진 한계:**

- **라벨 복원 불가**: 원본 `: "writes"` → 역파싱 후 `: "relates"`. 생성된 Mermaid에 주석으로 표시
- **다대다**: 조인 테이블 미생성으로 복원 불가
- **비표준 FK명**: `author_id`가 `Author` 엔티티가 없으면 관계 미생성

**라운드트립 검증:**

```
parse(blog.mmd) → generate Python → reverse_parse → to_mermaid → parse 재실행
엔티티: ✅ 이름·필드·타입·PK·FK 일치
관계:  ✅ 방향·카디널리티 일치 (라벨 제외)
```

---

### 5. LLM 보강 (`src/llm/enhancer.py`)

템플릿 생성 이후, Claude API를 통해 도메인 지식을 코드에 추가합니다.  
`--enhance` 플래그 사용 시 활성화되며, `ANTHROPIC_API_KEY`가 필요합니다.

**보강 내용:**

| 언어 | 대상 파일 | 추가 내용 |
|------|---------|---------|
| Python | `schemas/*.py` | EmailStr 타입, 비밀번호 최소 길이 validator, OpenAPI 예시값 |
| Python | `routers/*.py` | 중첩 엔드포인트 (`GET /users/{id}/posts`), 검색 쿼리 파라미터 |
| Java | `dto/*CreateDto.java` | `@NotBlank`, `@Email`, `@Size` Bean Validation |
| Kotlin | `dto/*Dto.kt` | `@field:NotBlank`, `@field:Email`, `@field:Size` |

**프롬프트 캐싱:**

시스템 프롬프트에 `cache_control: {"type": "ephemeral"}`을 적용하여 반복 호출 시 토큰 비용을 절감합니다.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    system=[{
        "type": "text",
        "text": SYSTEM_PYTHON,
        "cache_control": {"type": "ephemeral"},  # 캐싱
    }],
    ...
)
```

**설계 원칙:**

> 템플릿이 뼈대(구조), LLM이 살(도메인 지식)을 담당합니다.  
> LLM 없이도 템플릿만으로 완전히 동작하는 코드가 생성됩니다.  
> LLM은 기존 코드를 제거하거나 변경하지 않고 내용을 추가하기만 합니다.

---

### 6. Web UI (`web/`)

브라우저에서 ERD를 직접 그리고 코드를 생성하는 React 단일 페이지 애플리케이션입니다.

**기술 스택:**
- React 19 + TypeScript
- `@xyflow/react` v12 (ReactFlow) — 노드 기반 캔버스
- Vite 8 — 빌드 도구
- Vitest — 단위 테스트

**핵심 컴포넌트:**

```
web/src/
├── types.ts          # 공유 타입 정의 (ERDField, ERDEntityData, ERDEdge 등)
├── serializer.ts     # 그래프 상태 → Mermaid ERD 텍스트 변환 (핵심 로직)
├── serializer.test.ts# 직렬화기 단위 테스트 (8개)
├── App.tsx           # ReactFlow 캔버스, 노드/엣지 상태 관리
└── components/
    ├── EntityNode.tsx # 커스텀 엔티티 노드 (필드 인라인 편집)
    └── Sidebar.tsx    # 언어 선택, 프로젝트명, 생성 버튼, Mermaid 미리보기
```

**직렬화기의 핵심 계약 (`serializer.ts`):**

Web UI와 파이프라인의 계약 포인트입니다. 3가지 규칙을 반드시 지킵니다.

```typescript
// 규칙 1: 1:N 에지 → many-side에 FK 자동 삽입
// User →(one_to_many)→ Post 를 그리면 Post에 user_id FK 자동 추가

// 규칙 2: 모든 relation에는 label이 있어야 함 (파서 regex 요구사항)
const edgeLabel = edge.data?.label?.trim() || "relates";

// 규칙 3: edge 방향은 source=one, target=many
// ReactFlow에서 드래그 방향이 곧 관계 방향
```

---

### 7. API 서버 (`server.py`)

Web UI와 제너레이터를 연결하는 FastAPI 서버입니다.

**엔드포인트:**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/health` | 헬스체크 |
| `POST` | `/api/preview` | ERD 파싱 결과 JSON 반환 (엔티티, 관계 목록) |
| `POST` | `/api/generate` | 프로젝트 생성 후 ZIP 파일 반환 |
| `GET` | `/*` | React 빌드 파일 정적 서빙 (프로덕션) |

**요청/응답 예시:**

```json
// POST /api/generate
{
  "erd_mermaid": "erDiagram\n  User {\n    int id PK\n  }",
  "language": "python",
  "project_name": "my-api"
}

// 응답: application/zip (binary)
```

---

## 언어별 기술 스택

### Python

```
FastAPI 0.115      — REST 프레임워크, Swagger UI 자동 생성
SQLAlchemy 2.0     — ORM (선언형 매핑, 세션 관리)
Pydantic v2        — 요청/응답 DTO, 유효성 검증
Alembic            — 데이터베이스 마이그레이션
uvicorn            — ASGI 서버
psycopg2-binary    — PostgreSQL 드라이버
PostgreSQL 16      — 데이터베이스 (Docker)
```

### Java

```
Spring Boot 3.3    — REST 프레임워크
Spring Data JPA    — Repository 패턴, JPQL
Hibernate 6        — JPA 구현체
Lombok             — @Getter/@Setter/@Builder 등 보일러플레이트 제거
Flyway             — 데이터베이스 마이그레이션 (V1__init.sql)
Maven              — 빌드 도구
Java 21 (LTS)      — 런타임
PostgreSQL 16      — 데이터베이스 (Docker)
```

### Kotlin

```
Spring Boot 3.3    — REST 프레임워크
Spring Data JPA    — Repository 패턴
Hibernate 6        — JPA 구현체
kotlin("plugin.jpa")    — no-arg 생성자 자동 생성 (JPA 필수)
kotlin("plugin.spring") — all-open 적용 (Spring 프록시 필수)
Flyway             — 데이터베이스 마이그레이션
Gradle Kotlin DSL  — 빌드 도구 (build.gradle.kts)
Kotlin 1.9 / JVM 21
PostgreSQL 16      — 데이터베이스 (Docker)
```

> **Kotlin JPA 주의사항:** JPA 엔티티는 `data class`로 선언하면 안 됩니다.  
> Hibernate가 프록시 생성을 위해 상속이 필요하기 때문입니다.  
> `kotlin("plugin.jpa")` + `allOpen { annotation("jakarta.persistence.Entity") }` 로 처리됩니다.

---

## 생성 결과물 구조

### Python 프로젝트

```
my-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱, 라우터 등록
│   ├── database.py          # SQLAlchemy 엔진/세션/get_db
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py          # SQLAlchemy 모델 (엔티티당 1개)
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── user.py          # Pydantic: Base/Create/Update/Response
│   └── routers/
│       ├── __init__.py
│       └── user.py          # GET·POST /users, GET·PUT·DELETE /users/{id}
├── alembic/
│   ├── env.py               # 모든 모델 임포트, DB URL 설정
│   └── versions/            # 마이그레이션 파일 저장 위치
├── alembic.ini
├── .env                     # DATABASE_URL
├── requirements.txt
└── docker-compose.yml       # PostgreSQL 서비스
```

### Java/Kotlin 프로젝트

```
my-api/
├── src/main/java(kotlin)/com/example/myapi/
│   ├── MyApiApplication.java(kt)
│   ├── entity/User.java(kt)          # @Entity, @Table
│   ├── repository/UserRepository     # JpaRepository<User, Long>
│   ├── service/UserService           # 비즈니스 로직, @Transactional
│   ├── controller/UserController     # @RestController, 5개 엔드포인트
│   └── dto/
│       ├── UserCreateDto             # 생성 요청 DTO
│       ├── UserUpdateDto             # 수정 요청 DTO
│       └── UserResponseDto           # 응답 DTO + from(entity) 팩토리
├── src/main/resources/
│   ├── application.yml               # DB, JPA, Flyway 설정
│   └── db/migration/V1__init.sql    # 테이블 생성 SQL
├── pom.xml (또는 build.gradle.kts)
└── docker-compose.yml
```

### 생성되는 엔드포인트 (엔티티당)

| HTTP | 경로 | 동작 |
|------|------|------|
| `GET` | `/users` | 목록 조회 (skip/limit 페이지네이션) |
| `POST` | `/users` | 생성 (201 Created) |
| `GET` | `/users/{id}` | 단건 조회 (없으면 404) |
| `PUT` | `/users/{id}` | 전체 수정 (없으면 404) |
| `DELETE` | `/users/{id}` | 삭제 (204 No Content, 없으면 404) |

---

## 설치 및 실행

### 사전 요구사항

- Python 3.10+
- Node.js 18+
- Docker (PostgreSQL 실행용, 선택)

### 도구 설치

```bash
git clone <repo>
cd erd-to-api

# Python 의존성 (도구 자체)
python3 -m pip install -r requirements.txt
# jinja2, click, anthropic
```

### Web UI 빌드

```bash
cd web
npm install
npm run build   # → web/dist/ 생성
cd ..
```

### 서버 실행 (Web UI + API)

```bash
python3 server.py
# → http://localhost:8080
```

### 개발 모드 (핫리로드)

```bash
# 터미널 1 — 백엔드
python3 server.py

# 터미널 2 — 프론트엔드 (포트 5173)
cd web && npm run dev
```

---

## 사용법

### CLI 사용법

```bash
# 지원 스택 목록 확인
python3 main.py stacks

# 코드 생성 (대화형)
python3 main.py generate examples/blog.mmd

# 옵션 직접 지정
python3 main.py generate examples/blog.mmd \
  --lang python \
  --name blog-api \
  --out ./output

# LLM 보강 포함 생성 (ANTHROPIC_API_KEY 필요)
export ANTHROPIC_API_KEY=sk-ant-...
python3 main.py generate examples/blog.mmd \
  --lang python \
  --name blog-api \
  --enhance
```

**생성 후 Python 프로젝트 실행:**

```bash
cd output/blog-api
docker-compose up -d db           # PostgreSQL 시작
pip install -r requirements.txt
alembic revision --autogenerate -m "init"
alembic upgrade head               # 마이그레이션 실행
uvicorn app.main:app --reload
# → http://localhost:8000/docs     # Swagger UI
```

**생성 후 Java/Kotlin 프로젝트 실행:**

```bash
cd output/blog-api
docker-compose up -d db

# Java
mvn spring-boot:run

# Kotlin
./gradlew bootRun

# → http://localhost:8080
```

**역방향: 코드 → 다이어그램 (CLI):**

```bash
# 자동 언어 탐지
python3 main.py reverse ./output/blog-api

# 언어 명시 + 파일 저장
python3 main.py reverse ./output/blog-api --lang python --out recovered.mmd

# 출력 결과 확인
cat recovered.mmd
```

### Web UI 사용법

1. `http://localhost:8080` 접속
2. **엔티티 추가** — 왼쪽 사이드바 `+ 엔티티 추가` 버튼
3. **이름 편집** — 노드 헤더 더블클릭
4. **필드 편집** — 노드 내부에서 타입/이름 수정, PK·nullable 토글
5. **관계 연결** — 노드 오른쪽 핸들을 드래그해 다른 노드에 연결
6. **언어 선택** — 사이드바에서 python / java / kotlin 선택
7. **프로젝트명 입력**
8. **ZIP 다운로드** 버튼 클릭

**역방향 (코드 → 다이어그램):**

1. 사이드바 **`📂 프로젝트 ZIP 가져오기`** 클릭
2. 이 도구로 생성된 Python · Java · Kotlin 프로젝트 ZIP 선택
3. 자동으로 언어 탐지 → 캔버스에 엔티티·관계 복원

> Mermaid 미리보기 토글로 현재 그래프가 어떤 ERD 텍스트로 직렬화되는지 실시간 확인 가능합니다.  
> 역방향 복원 시 관계 라벨은 "relates"로 표시됩니다 (원본 복원 불가). 캔버스에서 직접 편집하세요.

---

## 프로젝트 파일 구조

```
erd-to-api/
├── main.py                  # CLI 진입점 (click)
├── server.py                # FastAPI 서버 (Web UI + API)
├── requirements.txt         # 도구 의존성 (jinja2, click, anthropic)
├── examples/
│   └── blog.mmd             # 샘플 ERD (User, Post, Comment)
│
├── src/
│   ├── config/
│   │   └── stacks.py        # 언어별 스택 설정 (StackConfig)
│   ├── ir/
│   │   └── models.py        # IR 데이터 모델 (ERDiagram, IREntity, IRField, IRRelation)
│   ├── parser/
│   │   └── mermaid.py       # Mermaid ERD → IR 파서
│   ├── generators/
│   │   ├── base.py          # BaseGenerator (Jinja2 환경)
│   │   ├── python/
│   │   │   ├── generator.py
│   │   │   └── templates/   # 9개 Jinja2 템플릿
│   │   ├── java/
│   │   │   ├── generator.py
│   │   │   └── templates/   # 12개 Jinja2 템플릿
│   │   └── kotlin/
│   │       ├── generator.py
│   │       └── templates/   # 10개 Jinja2 템플릿
│   ├── llm/
│   │   └── enhancer.py      # Claude API 보강 (스키마/라우터/DTO)
│   └── reverse/
│       ├── detector.py       # 언어 자동 탐지 + 파서 디스패치
│       ├── mermaid_writer.py # ERDiagram → Mermaid 텍스트
│       ├── python_parser.py  # SQLAlchemy 모델 → ERDiagram
│       ├── java_parser.py    # JPA 엔티티(Java) → ERDiagram
│       └── kotlin_parser.py  # JPA 엔티티(Kotlin) → ERDiagram
│
└── web/                     # React 프론트엔드
    ├── src/
    │   ├── types.ts          # 공유 타입
    │   ├── serializer.ts     # 그래프 → Mermaid 직렬화기
    │   ├── serializer.test.ts# Vitest 단위 테스트 (8개)
    │   ├── App.tsx           # ReactFlow 캔버스
    │   └── components/
    │       ├── EntityNode.tsx # 커스텀 노드
    │       └── Sidebar.tsx   # 컨트롤 패널
    ├── package.json
    └── vite.config.ts
```

---

## 설계 원칙과 제약사항

### 핵심 설계 원칙

**1. IR이 소스 오브 트루스**  
파서와 제너레이터는 IR을 통해서만 통신합니다. 새 언어를 추가할 때 파서를 수정할 필요가 없습니다.

**2. 템플릿이 뼈대, LLM이 살**  
LLM 없이 템플릿만으로 완전히 동작하는 코드를 생성합니다. LLM은 도메인 지식(유효성 검증, 중첩 엔드포인트)을 선택적으로 추가합니다.

**3. 검증 우선**  
Python 경로는 실제 FastAPI + SQLite 환경에서 전체 CRUD 동작을 smoke test로 검증했습니다.

**4. 직렬화기-파서 계약**  
Web UI의 직렬화기(`serializer.ts`)는 파서의 요구사항을 코드 레벨에서 보장합니다.  
- 모든 relation에 label 포함
- 1:N 에지 시 many-side에 FK 자동 삽입
- 방향: source=one, target=many

### 알려진 제약사항

| 제약 | 설명 |
|------|------|
| 다대다 관계 | 조인 테이블 생성 미지원. 관계 선언만 생성됨 |
| Java/Kotlin 검증 | 이 환경에 JDK가 없어 컴파일 검증 불가. 생성된 파일 구조는 완전함 |
| LLM 보강 | `ANTHROPIC_API_KEY` 환경변수가 없으면 건너뜀 (오류 아님) |
| 단순 복수형 | 영어 기반 단순 복수화 (`y→ies`, 나머지 `+s`). `Person→People` 등 불규칙 형태 미지원 |
| FK 경로 추론 | `user_id FK` → `ForeignKey("users.id")`는 `_id` 제거 + `s` 추가로 추론. 비표준 테이블명 시 오류 가능 |

---

## 확장 가이드

### 새 언어 추가

1. `src/generators/<언어>/generator.py` — `BaseGenerator` 상속
2. `src/generators/<언어>/templates/` — Jinja2 템플릿 추가
3. `src/config/stacks.py` — `STACKS` 딕셔너리에 `StackConfig` 추가
4. `main.py` — `GENERATORS` 딕셔너리에 등록
5. `server.py` — `GENERATORS` 딕셔너리에 등록

### 새 다이어그램 타입 지원

현재는 ERD만 지원합니다. 시퀀스 다이어그램 등을 추가하려면:

1. `src/parser/` 에 새 파서 추가
2. `src/ir/models.py` 에 새 IR 모델 추가 (또는 기존 확장)
3. 제너레이터에서 새 IR 타입 처리

### LLM 보강 대상 추가

`src/llm/enhancer.py` 에서 새 보강 함수를 작성하고 `enhance_project()`에 연결합니다.

```python
def enhance_python_tests(client, entity, router_code) -> str:
    # 라우터 코드를 바탕으로 테스트 코드 생성
    ...
```
