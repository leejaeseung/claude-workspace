# ADR-001: OpenSearch Client 기술 스택 선택

| 항목 | 내용 |
|------|------|
| 상태 | 확정 (2026-06-03) |
| 결정자 | 박지훈 (feature-develop-leader) |
| 검토자 | 강민서, 하진우 |

---

## 맥락

Jason Company 내부 운영팀이 OpenSearch에 저장된 로그/이벤트 데이터를 조회하고 CSV로 내보내기 위한 GUI 데스크톱 클라이언트 도구가 필요하다. 가계부 앱 개발과 병행하므로 팀 내 기존 Kotlin 역량을 최대한 재활용해야 하며, 배포는 단순 exe 폴더(인스톨러 없음)로 제한한다. 로컬 Docker 환경과 운영 서버 연결을 모두 지원해야 한다.

---

## 결정: **Kotlin + Compose Multiplatform Desktop**

---

## 선택지 비교

### 선택지 A: Kotlin + Compose Desktop (채택)

| 항목 | 평가 |
|------|------|
| 언어 | Kotlin — 팀 주력 언어, 학습 비용 0 |
| UI 프레임워크 | Compose Multiplatform 1.8.0 (JetBrains) — 선언형 UI, Material Design 내장 |
| 빌드 | Gradle Kotlin DSL — 팀 표준 빌드 도구 동일 |
| 배포 | `createDistributable` → JRE 번들 폴더 + .exe 런처. 인스톨러 없음. |
| 에러 처리 | Arrow-kt Either — 팀 표준 함수형 패턴 직접 적용 가능 |
| 리스크 | Compose Desktop은 서버사이드 Kotlin과 다른 렌더링 모델(Skia). 팀 내 최초 적용. |

### 선택지 B: Electron + TypeScript (기각)

| 항목 | 평가 |
|------|------|
| 장점 | 웹 생태계 활용, UI 자유도 높음 |
| 기각 이유 | TypeScript 비주력 언어, Arrow-kt 패턴 적용 불가, Kotlin 팀 역량 미활용, 번들 크기 큼(150MB+) |

### 선택지 C: JavaFX + Kotlin (기각)

| 항목 | 평가 |
|------|------|
| 장점 | JVM 네이티브, 검증된 데스크톱 프레임워크 |
| 기각 이유 | Compose Desktop 대비 보일러플레이트 과다, 선언형 UI 지원 미흡, JetBrains 공식 지원 없음 |

### 선택지 D: Python + tkinter/PyQt (기각)

| 항목 | 평가 |
|------|------|
| 장점 | 빠른 프로토타이핑 |
| 기각 이유 | 팀 비주력 언어, 타입 안전성 결여, 배포 복잡 |

---

## 핵심 버전 결정

| 라이브러리 | 버전 | 근거 |
|-----------|------|------|
| Kotlin | 2.1.20 | Compose 1.8.0 요구 최소 버전(2.1.0+)의 최신 패치 |
| Compose Multiplatform | 1.8.0 | 2025년 기준 최신 안정 버전 |
| OpenSearch Java Client | 3.8.0 | 공식 클라이언트 최신 안정 (mvnrepository 확인) |
| Arrow-kt | 2.2.0 | 팀 표준 함수형 라이브러리 최신 안정 |
| kotlinx.serialization | 1.8.0 | Kotlin 2.1.0 호환 최신 버전 |

---

## 배포 전략 결정

**배포 요건**: 단순 exe 파일만, 인스톨러 불필요

**결론**: Compose Desktop의 `createDistributable` Gradle task 사용

```
./gradlew :app:createDistributable
# 산출물: app/build/compose/binaries/main/app/
# 내용: <앱명>.exe + bundled JRE + lib/
# 배포 방법: 폴더를 zip으로 묶어 공유 → 압축 해제 후 exe 실행
```

- `TargetFormat.Exe`/`TargetFormat.Msi`는 설치 과정이 있는 인스톨러를 생성하므로 선택하지 않음
- `createDistributable` Gradle task는 `TargetFormat`과 무관하게 실행 가능하며, bundled JRE + 런처 exe를 포함한 폴더를 생성한다. 이 폴더를 zip으로 공유하면 인스톨러 없이 즉시 실행 가능

---

## 연결 프로파일 전략

로컬 Docker(`http://localhost:9200`) ↔ 운영 서버(`https://...`) 두 환경을 동시에 지원하기 위해:

1. `ConnectionProfile` 도메인 모델에 `ProfileEnvironment` enum(LOCAL/PRODUCTION) 포함
2. `ConnectionProfileRepository`가 `~/.opensearch-client/profiles.json`에 직렬화 저장
3. TLS 검증을 `tlsVerifyEnabled` 플래그로 제어 (로컬: false, 운영: true)
4. 비밀번호는 현재 plain-text 저장 — 향후 스프린트에서 OS keystore 연동 예정

---

## 결과 및 트레이드오프

| 항목 | 결과 |
|------|------|
| 팀 학습 비용 | 낮음 — Kotlin/Gradle/Arrow-kt 동일 스택 |
| UI 개발 생산성 | 높음 — Compose 선언형 UI |
| 배포 복잡도 | 낮음 — 폴더 압축 공유 |
| Compose Desktop 숙련도 | 초기 러닝 커브 있음 — 파일럿 검증 후 팀 공유 세션 예정 |
| 성능 | Skia 기반 렌더링으로 JVM 데스크톱 대비 우수 |
