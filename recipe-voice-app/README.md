# recipe-voice-app

음성 인식 기반 레시피 모음집 모바일 앱. 상세 설계는 계획 문서(`/home/wasd222/.claude/plans/humming-roaming-crab.md`)를 참고.

레시피 **등록은 직접 입력만** 지원한다(음성 등록 기능은 제거함). 음성은 **검색**과 **요리 중 핸즈프리
탐색**(다음 단계/재료 안내/타이머)에만 쓰인다.

## 구조

- `mobile/` — React Native + Expo(Dev Client) 앱. Expo Router 기반 라우팅(`mobile/src/app/`).
  앱을 처음 실행하면 테스트용 샘플 레시피 5개가 자동으로 채워진다(`mobile/src/db/seed.ts`).
- `backend/` — Node.js + TypeScript + Express API. 레시피 CRUD, 동기화, 핸즈프리 인텐트 추정(LLM) 프록시.
- `contracts/openapi.yaml` — API 계약 (클라이언트 타입 생성 소스).

## 시작하기

### 백엔드

```bash
cd backend
cp env.template .env   # 값 채우기: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npm run migrate         # PostgreSQL에 스키마 생성 (DATABASE_URL 필요)
npm run dev              # http://localhost:4000
```

`env.template`의 `ALLOW_ANON_VOICE=true`는 로그인 화면이 아직 없어도 `/api/voice/intent`를 바로
테스트할 수 있게 인증을 건너뛴다. 회원가입/로그인 화면을 붙인 뒤에는 반드시 `false`로 되돌려야 한다.

### 모바일

**중요**: 이 앱은 `expo-speech-recognition` 등 커스텀 네이티브 모듈을 사용하므로 **Expo Go에서는 동작하지 않는다.**
Dev Client 빌드가 필요하다.

```bash
cd mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --profile development --platform android
```

빌드된 앱을 폰에 설치한 뒤:

```bash
npx expo start --tunnel
```

폰에서 Dev Client 앱을 열고 터미널의 QR을 스캔한다. 백엔드 주소는 `mobile/.env`에
`EXPO_PUBLIC_API_BASE_URL=http://<백엔드가 실제로 접근 가능한 주소>:4000`으로 설정한다
(폰과 개발 머신이 같은 사설망에 있어야 하며, `localhost`는 폰에서 접근 불가).

단위 테스트(한국어 정규화, 인텐트 매처):

```bash
cd mobile && npm test
```

### 다크/라이트 모드

시스템 설정(라이트/다크)에 따라 자동으로 배색이 바뀐다(`mobile/src/theme.ts`,
`mobile/src/app/_layout.tsx`의 `ThemeProvider`). placeholder 색상도 테마별로 대비를 확보한
값을 쓴다. 요리 모드(`recipe/[id]/cook.tsx`)는 주방에서의 가시성을 위해 시스템 설정과 무관하게
항상 어두운 배색을 유지한다(의도된 예외).

## Milestone 0 — 음성 스파이크 (실기기 필수, 코드 작업 전에 검증)

아래 항목은 시뮬레이터/에뮬레이터로 확인할 수 없다. 실기기에서 직접 확인해야 한다:

1. **온디바이스 한국어 인식 지원 여부**: Android(오프라인 언어팩 설치/미설치 각 1대), iPhone에서
   `ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()` 결과를 로그로 확인.
2. **연속 리스닝 안정성**: 요리 모드(`mobile/src/app/recipe/[id]/cook.tsx`)를 20분 이상 켜둔 채
   배터리 소모/발열/인식 끊김을 체감 확인. `useCookModeRecognition`의 재시작 루프가 실제로
   버티는지가 핵심이다. 아울러 **요리 모드를 벗어난 뒤 마이크 인디케이터(OS 상태표시줄의 녹색
   점/마이크 아이콘)가 실제로 꺼지는지도 실기기에서 확인** — 개인정보 관점에서 중요한 항목이다.

3. **웨이크워드(별명) 인식 신뢰도**: 설정 화면에서 별명(기본값 "셰프야")을 바꿀 수 있다. 다만 현재
   구현은 **소프트웨어 게이트**다 — 마이크/연속 인식 세션은 이전과 동일하게 계속 켜져 있고,
   별명이 들리기 전까지는 "명령으로 처리하지 않을 뿐"이다. 즉 배터리/마이크 사용량은 줄지 않는다.
   실기기의 도마질/물소리/후드팬 소음 속에서 별명이 오탐(false wake) 또는 미탐(missed wake) 없이
   인식되는지 확인 필요. 진짜 저전력 웨이크워드가 필요하면 Picovoice Porcupine 등 전용 SDK +
   커스텀 한국어 모델 학습 + 새 네이티브 모듈 + 새 EAS 빌드가 필요하다 — 자세한 내용은 계획 문서의
   "남은 미확정 사항" 참고.

## 아직 구현되지 않은 것

- 회원가입/로그인 화면(백엔드 API는 있음, `ALLOW_ANON_VOICE`로 우회 중).
- 온디바이스 미지원 기기에서의 온라인 인식 폴백 UX 배너(현재는 요리 모드에 경고 텍스트만 표시).
- EAS `production`/`preview` 프로필로의 실제 배포 파이프라인(`eas.json`은 준비됨).
