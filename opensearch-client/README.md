# OpenSearch Client — Jason Company

Kotlin + Compose Desktop 기반 OpenSearch GUI 클라이언트.  
로컬 Docker 환경과 운영 서버 연결을 프로파일로 관리하며, 검색 결과를 CSV로 내보낼 수 있습니다.

---

## 주요 기능

- **연결 프로파일 관리**: 로컬/운영 환경을 별도 프로파일로 저장 (`~/.opensearch-client/profiles.json`)
- **전문 검색**: 키워드 + 필드 선택 + 날짜 범위 + 정렬 + 페이징
- **Term 필터**: 정확값 필터 조건 추가
- **CSV 내보내기**: 컬럼 선택 후 로컬 파일로 저장 (UTF-8 BOM)
- **문서 상세 보기**: 클릭으로 _source 전체 필드 확인
- **인덱스 목록 자동 조회**: 연결 시 사용 가능한 인덱스 드롭다운 제공

---

## 사전 요구사항

| 항목 | 버전 |
|------|------|
| JDK | 21 (Adoptium Temurin 권장) |
| Gradle | Wrapper 포함 (별도 설치 불필요) |
| OpenSearch | 2.x (Docker 또는 바이너리 직접 실행) |

---

## 로컬 개발 환경 실행

> **WSL2 환경 (Docker 없이 바이너리 직접 실행)**: [`docs/local-setup.md`](./docs/local-setup.md) 참고

### 1. OpenSearch 로컬 서버 실행

**Docker 방식:**
```bash
cd docker
docker compose up -d
```

**바이너리 직접 실행 방식 (WSL2 / Docker 없는 환경):**
```bash
export JAVA_HOME=~/jdk/jdk-21.0.5+11
nohup ~/opensearch-local/opensearch-2.19.0/bin/opensearch > /tmp/opensearch.log 2>&1 &
```

Health 확인:
```bash
curl http://localhost:9200/_cluster/health
```

### 2. 앱 빌드 & 실행

```bash
export JAVA_HOME=~/jdk/jdk-21.0.5+11
export PATH=$JAVA_HOME/bin:$PATH
export DISPLAY=:0   # WSLg 사용 시

cd app
./gradlew run
```

처음 실행 시 `~/.opensearch-client/profiles.json`에 두 개의 기본 프로파일이 생성됩니다.  
"로컬 Docker" 프로파일을 선택하면 바로 연결됩니다.

### 3. IDE에서 실행

IntelliJ IDEA에서 `app/` 폴더를 Gradle 프로젝트로 열고 `Main.kt`의 `main()` 함수를 실행합니다.

---

## 배포 (exe 폴더 생성)

인스톨러 없이 폴더 형태로 배포합니다 (bundled JRE 포함):

```bash
cd app
./gradlew createDistributable
```

산출물 위치:
```
app/build/compose/binaries/main/app/
├── OpenSearch Client.exe    ← 실행 파일
├── runtime/                 ← 번들된 JRE
└── app/                     ← 앱 jar
```

배포 방법: `app/` 폴더를 zip으로 묶어 공유. 수신자는 압축 해제 후 `.exe` 바로 실행.

---

## 프로파일 설정

앱 상단 바에서 프로파일을 전환하거나 추가/편집할 수 있습니다.

| 설정 항목 | 설명 |
|----------|------|
| 이름 | UI에 표시될 프로파일 이름 |
| 호스트 / 포트 | OpenSearch 엔드포인트 |
| 스킴 | `http` 또는 `https` |
| 기본 인덱스 | 검색 시 기본으로 사용할 인덱스 (생략 가능) |
| 사용자명 / 비밀번호 | Basic Auth 인증 정보 |
| 환경 | LOCAL / PRODUCTION 구분 |
| TLS 인증서 검증 | 운영 서버: 활성화, 로컬: 비활성화 권장 |

프로파일은 `~/.opensearch-client/profiles.json`에 저장됩니다.

---

## 프로젝트 구조

```
opensearch-client/
├── README.md
├── docker/
│   └── docker-compose.yml       # 로컬 OpenSearch 2.x + Dashboards
├── app/                         # Gradle 프로젝트 루트
│   ├── build.gradle.kts         # Compose Desktop + 의존성
│   ├── settings.gradle.kts
│   └── src/main/kotlin/com/jasoncompany/opensearchclient/
│       ├── Main.kt              # 앱 진입점 + 테마
│       ├── ui/
│       │   ├── MainScreen.kt    # 루트 Composable (상태 관리)
│       │   ├── SearchPanel.kt   # 검색 조건 입력 패널
│       │   └── ResultTable.kt   # 결과 테이블 + 페이징 + CSV
│       ├── domain/
│       │   ├── SearchCondition.kt   # 검색 조건 모델
│       │   └── SearchResult.kt      # 결과 모델 + SearchError
│       ├── service/
│       │   ├── OpenSearchService.kt # OpenSearch Java Client 래퍼
│       │   └── CsvExportService.kt  # CSV 내보내기
│       └── config/
│           └── ConnectionProfile.kt # 프로파일 모델 + 저장소
└── docs/
    └── ADR-001-tech-stack.md    # 기술 선택 의사결정 기록
```

---

## 기술 스택

| 항목 | 버전 |
|------|------|
| Kotlin | 2.1.20 |
| Compose Multiplatform | 1.8.0 |
| OpenSearch Java Client | 3.8.0 |
| Arrow-kt | 2.1.0 |
| kotlinx.serialization | 1.8.0 |
| kotlinx.coroutines | 1.10.1 |

기술 선택 근거 → [`docs/ADR-001-tech-stack.md`](./docs/ADR-001-tech-stack.md)

---

## 에러 처리 패턴

서비스 레이어는 모두 `Either<SearchError, T>`를 반환합니다.

```kotlin
service.search(condition)
    .fold(
        ifLeft  = { error -> /* SearchError 처리 */ },
        ifRight = { result -> /* 성공 처리 */ },
    )
```

`SearchError` 계층:
- `ConnectionFailed` — 연결 실패
- `QueryFailed` — 쿼리 실행 오류
- `IndexNotFound` — 인덱스 없음 (404)
- `AuthenticationFailed` — 인증 오류 (401)
- `UnknownError` — 기타

---

## 개발 중인 기능 (백로그)

- [ ] 다중 Term 필터 (현재 1개 고정)
- [ ] 저장된 검색 조건 (즐겨찾기)
- [ ] 연결 프로파일 비밀번호 OS keystore 암호화
- [ ] 다크 테마
- [ ] JSON raw 보기 (문서 상세)
