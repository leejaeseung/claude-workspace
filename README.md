# US 주식 브리핑

미국 주식 티커(또는 회사 이름)를 입력하면 서버가 웹에서 최신 정보를 수집해 요약하고, 규칙 기반 지표로 앞으로의 주가 방향성(단기·중기)을 보여 주는 Android 앱입니다. AI를 쓰지 않고 크롤링한 데이터와 계산식만으로 동작합니다.

```
stock-app/
├── src/            Expo(React Native) 앱 — Expo Router
│   ├── app/        화면: index(검색), stock/[ticker](분석 결과)
│   ├── components/ 카드·차트·방향성 게이지 등
│   └── lib/        API 클라이언트, 타입(server/src/types.ts 사본), 테마
└── server/         Node.js 분석 서버 (TypeScript, tsx로 실행)
    └── src/
        ├── sources/   Yahoo Finance(시세·검색·뉴스 RSS), Finviz(재무·애널리스트·뉴스), Google 뉴스 RSS
        └── analysis/  기술적 지표, 헤드라인 감성 분석, 방향성 점수, 한국어 요약 생성
```

## 실행

### 1. 서버

```bash
cd server
npm install
npm run dev          # http://0.0.0.0:8787
npm test             # 지표·감성·방향성 단위 테스트
```

API
분석은 백그라운드 작업으로 돌아갑니다. 요청하면 바로 응답하고, 서버가 자료를 수집(동시에 최대 2종목)해 `server/data/reports.json`에 저장합니다. 앱은 나중에 목록에서 결과를 확인합니다. 서버를 다시 시작하면 중단된 작업은 다시 대기열에 들어갑니다.

- `POST /api/reports/:ticker` — 분석(재수집) 요청. 202와 함께 상태 요약을 바로 돌려줍니다. 이미 대기·수집 중이면 그 작업을 그대로 돌려줍니다.
- `GET /api/reports` — 요청한 종목 목록과 상태(`queued`·`running`·`done`·`error`), 가격·방향성 요약
- `GET /api/reports/:ticker` — 전체 분석 결과(`analysis`). 재수집 중이거나 실패해도 마지막 성공 결과는 남아 있습니다.
- `DELETE /api/reports/:ticker` — 목록에서 삭제
- `GET /api/search?q=nvidia` — 미국 상장 주식·ETF 검색

환경 변수: `PORT`(기본 8787), `DATA_FILE`(기본 `server/data/reports.json`)

### 2. 앱

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL을 휴대폰에서 접근할 수 있는 서버 주소로 바꾸세요
npx expo start         # Expo Go 앱으로 QR 코드를 스캔하거나, a 키로 에뮬레이터 실행
```

### 원격(클라우드) 서버에서 휴대폰으로 테스트

같은 Wi-Fi에 있지 않을 때는 서버와 Expo를 모두 터널로 엽니다.

```bash
scripts/tunnel.sh my-subdomain   # https://my-subdomain.loca.lt — 끊기면 같은 주소로 자동 재연결
# .env: EXPO_PUBLIC_API_URL=https://my-subdomain.loca.lt
npx expo start --tunnel ngrok    # 출력된 exp://….exp.direct 주소를 Expo Go에 입력
```

- Android 에뮬레이터는 기본값 `http://10.0.2.2:8787`로 PC의 서버에 접속합니다.
- 실제 휴대폰은 PC와 같은 Wi-Fi에 연결하고 `EXPO_PUBLIC_API_URL=http://<PC의 LAN IP>:8787`로 설정하세요.
- 설치용 APK: `npx eas-cli@latest build -p android --profile preview` (Expo 계정 필요). 서버를 HTTPS 주소에 배포하는 것을 권장하지만, 테스트용으로 HTTP도 쓸 수 있도록 `usesCleartextTraffic`을 켜 두었습니다.

## 방향성 판단 방식

신호마다 -1(약세)~+1(강세) 점수와 가중치를 매기고, 가중 평균을 -100~+100으로 환산합니다. ±15를 넘으면 상승·하락, 그 사이면 보합으로 봅니다.

| 구분 | 신호 |
|---|---|
| 중기 (3~6개월, 60%) | 200일선 대비 위치, 50/200일선 골든·데드크로스, 6개월 수익률, 애널리스트 평균 의견, 목표가 상승여력, 내년 EPS 성장 전망 |
| 단기 (1~4주, 40%) | 20일선 대비 위치, MACD 히스토그램 방향, RSI(과매수·과매도), 1개월 수익률, 최근 7일 뉴스 분위기(최신 기사일수록 가중), 거래량 급증 |

신뢰도는 점수의 크기와 신호가 서로 얼마나 같은 방향을 가리키는지로 정합니다. 단기와 중기가 엇갈리면 '높음'이 나오지 않습니다.

뉴스 감성은 헤드라인의 금융 어휘(beat, downgrade, plunge 등)를 사전으로 채점하는 단순한 방식이라 반어법이나 맥락은 놓칠 수 있습니다.

## 주의

- 이 앱의 결과는 참고용이며 투자 권유가 아닙니다.
- Yahoo Finance·Finviz·Google 뉴스의 비공식 경로를 크롤링하므로, 각 사이트 구조가 바뀌면 일부 항목이 비어 보일 수 있습니다(실패한 출처는 화면 아래에 표시). 개인 용도로 쓰고, 요청이 많아질 때는 공식 데이터 API로 바꾸는 것을 권장합니다.
- `src/lib/types.ts`는 `server/src/types.ts`의 사본입니다. 응답 형식을 바꾸면 둘 다 고치세요.
