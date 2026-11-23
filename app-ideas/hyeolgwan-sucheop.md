> ⛔ 중단 (2026-11-23): 단계 0에서 업그레이드 2회 연속 통과 실패(정체 2). v3 '양방향 천자 처방전' 재심사 평균 3.17(UR3·C3·M3·F4·B3·R3, KILL 0) — 통과 기준 3.5 미달, 직전 3.17 대비 개선 0. 공통 비판: 일반 PTA 후 '피할 구간' 지시 자체가 임상적으로 드물어 처방전 내용이 비기 쉽고, 종이 퇴원 안내문·회신서가 같은 정보를 전달하며, 외래 요약의 '지시 준수 여부'가 투석실 감사 기록이 되고, 서명 없는 QR이 '의사 지시' 권위를 달아 위조·오입력 위험.

# 혈관수첩 (가칭) — 투석혈관 시술 후 12주 기록 도구

> 투석혈관 시술(PTA·혈전제거·신규 동정맥루 첫 천자) 직후 혈액투석 환자가 다음 외래까지 8~12주 동안 투석 회차별 천자 결과와 집에서의 이상 신호를 기록하고, 외래 때 1장 요약으로 들고 가는 기간 한정 도구 (판정·진단 없음)

- 상태: DROPPED · 단계: 0 (보완 필요) · 버전: v1.1 (v2·v3 업그레이드 시도 모두 실패)
- 최초 기획일: 2026-11-22 · 마지막 업그레이드: 2026-11-23 (v3 시도, DROPPED)
- 최근 심사 결과: 평균 3.17 / 5 (user-reality 3 · creativity 3 · market 3 · feasibility 4 · business 3 · risk 3) — 2026-11-23 UPGRADE 재심사, KILL 0, 통과 기준(평균 3.5) 미달
- 존재 확인 판정: DIFFERENTIATED (2026-11-23 재확인. 간호사용 전자 천자 아틀라스 발견으로 차별점은 '기관 사이 운반'으로 좁아짐)
- 사용한 발산 기법: 하루 마찰 일기, 센서 × 상황, 오프라인 행동 디지털화, 제약 강제, 이웃 분야 이식(주사 부위 순환 → 천자 위치)
- ⚠️ 단계 0에서 업그레이드 1회 실패. 다음 업그레이드에서도 통과 못 하면 규칙상 DROPPED (단계 0 2회 실패 / 정체 2)

## 1. 문제
- 누가: 주 3회 혈액투석 환자 중 최근 투석혈관 시술을 받은 사람. 국내 투석 환자 13만 명 이상(2026 학회 인용 보도), 혈액투석 약 12만 명. 시술 실환자 연 2만~3.5만 명 추정(market 심사위원: 대만 PTA 투석 1,000회당 3.23회 기준 추산, 심평원 전국 통계는 미확인). "3개월마다 반복 시술받는 환자가 상당수"(데일리메디) → 반복 시술 환자가 핵심 세그먼트
- 언제: (1) 시술 후 첫 투석들에서 바늘을 꽂을 때 — 간호사가 회차마다 바뀌고 지난번 위치는 환자 기억에 의존. 가이드라인은 rope-ladder 순환을 권하고 같은 구역 반복 천자를 금함. 침윤은 천자 시도의 5~7%(NKF). (2) 시술 후 외래 — 혈관센터는 투석실과 다른 기관인 경우가 많아 그 사이 천자·지혈 경과를 볼 수 없음
- 지금은 어떻게 해결하나: 투석실 종이 천자 기록지(일부 기관), 환자 기억, 말로 전달, 외래 초음파
- 왜 지금인가: 2026년 치료 초점이 '넓히기'에서 '오래 유지하기'로 이동(머니투데이 2026-04). 2025-05부터 'PTA 후 3개월 내 재협착' 동정맥루에 약물방출풍선 급여 적용 → 시술 후 3개월 경과가 진료 판단의 기준 구간이 됨(메디컬타임즈)

## 2. 해결책 (v1.1 — v2 시도 중 심사위원이 유효하다고 본 변경만 반영)
### 핵심 경험 (첫 30초)
1. 혈관센터 퇴원 안내문 QR → 설치 → 앱 안에서 같은 QR을 한 번 더 스캔(센터 연락처·혈관 종류 템플릿 입력, 서버 없음)
2. 시술일·다음 외래일 입력 → 홈 화면에 "외래까지 D-62"와 응급 연락 카드
3. 첫 투석 때 결과 원탭(한 번에/재천자/멍·부음/지혈 오래)

### 핵심 기능 (MVP)
1. 회차별 천자 결과 기록(원탭) + 천자 위치(보조, '모름' 허용). 위치 모델과 보여 주는 방식은 미해결(아래 5절)
2. '평소와 다름' 예외 버튼: '떨림 없음/약함'은 별도 긴급 등급(즉시 시술 기관·응급실), 붓기·차가움·통증·집 출혈은 연락 안내. 응급 경로는 GPS 없이 119·E-gen 링크
3. 외래 1장 요약: 시술일~외래일 타임라인(재시술 간격, 이상 신호 발생일, 천자 결과 합계). "환자 자가기록, 투석실 기록을 대체하지 않음" 문구, 사진 기본 제외
4. 외래 후 '쉬는 모드'(예외 버튼만), 다음 시술 때 새 기간 시작
5. 계정·서버·보호자 링크 없음, 기기 안 저장 + 암호화 백업, exact alarm 대신 투석 요일 기반 비정확 알림 1회

### 모바일이라서 가능한 점
투석 중 한 손 탭, 투석 회차라는 자연스러운 사용 계기, 앱 안 QR 스캔 설정, 원탭 전화, D-day 위젯(v1.1 이후)

### 하지 않을 것 (Non-goals)
- 협착·혈전 감지/예측, 정상/이상 색 판정, 혈관음 분석
- 투석기 숫자(Qb·정맥압) 입력 — v1에서 삭제 (투석실이 이미 기록)
- 버튼홀(같은 자리 천자) 환자 대상 천자 분포 기능
- 장비사 후원 (공정경쟁규약·이해상충 검토 전까지 보류)

## 3. 경쟁 및 차별점
### 존재 확인: 후보 A — 투석혈관 일지 ("혈관수첩")
검색 쿼리 (14개, 영·한·일·중):
1. "app for hemodialysis patients track AV fistula thrill bleeding time" — 소비자 앱 없음. Fresenius/RRI 동맥류 사진 분류 앱(연구), KidneyX 기기, HAVSE 센서 연구
2. "dialysis access self-monitoring app fistula check log" — ESRD Network·ASDIN 'AVF Patient Checks' 종이 점검지, 터키 교육앱 임상시험(NCT04925635)
3. "투석 환자 동정맥루 관리 앱" — 앱 없음, "지혈 지연·떨림 약화 시 진료" 권고 기사만
4. "혈액투석 지혈시간 기록 스릴 자가점검 어플" — 혈압·INR·출혈질환(Robust Health) 앱만
5. "site:apps.apple.com dialysis fistula" — Dialysis Pro, KidneyKind, Nx2me, PD Management, My Vascular Access, iDialysis: 스릴·지혈 기능 없음(페이지 확인)
6. "site:play.google.com dialysis tracker fistula" — Dialysis Diary, Dialysis Pro, Dialysis Diet Tracker, InBioZ: 혈관 점검 없음
7. "site:play.google.com fistula app hemodialysis access" — 전용 앱 없음, B. Braun nexadia(의료진용)
8. "\"vascular access\" app patients log thrill bruit \"bleeding time\" hemodialysis smartphone" — 특허, 일본 스마트폰 혈관음 연구(3명)
9. "reddit dialysis app track fistula thrill bleeding after needles" — 스레드 없음, NHS 가이드 "지혈 지연=협착 신호"
10. "シャント 管理 アプリ 透析 患者 シャント音 記録" — 연구·종이 카르테만
11. "内瘘 自我监测 APP 小程序 血液透析 震颤 止血时间 记录" — 병원 연구 플랫폼만
12. "AV fistula care app patients daily thrill check reminder" — NephroLog, NephroPulse, DotiGuard(혈관 기능 없음), 충칭의대 AVF 추적관리 mHealth 앱(Frontiers in Medicine 2026, 5·21·42일차 스릴·상처, 60일차 지혈 시간 보고 → 케이스매니저 연락; 병원 내부 도구)
13. "혈액투석 환자 자가관리 모바일 앱 출시 투석실 연동" — 국내는 복막투석 MyPD뿐
14. "Samsung Health/Apple Health symptom log, Bearable custom tracker dialysis" — 범용 트래커(Bearable, CareClinic)로 사용자 정의 증상 기록 가능
(메인 D5 사전 검색: "투석 후 지혈 시간 기록 앱", "app log dialysis needle bleeding time after treatment fistula stenosis trend" — 전용 앱 없음. Fistula First 자료: 지혈 지연 패턴은 협착 신호, 단 항혈소판제·항응고제 복용자는 원래 지혈이 길어 교란변수)

발견된 유사 서비스:
| 이름 | 플랫폼 | 겹치는 점 | 다른 점 | 상태 |
|---|---|---|---|---|
| Dialysis Pro (구 D-Track) | iOS/Android | 혈액투석 기록, 메모, CSV, 추세 차트 | 지혈 스톱워치·스릴 점검·혈관 이상 규칙 없음 | 활성(2026-09), iOS 평점 7개 |
| Dialysis Diary | Android | 회차·바이탈·약 기록 | 혈관 기능 없음 | 소규모 |
| KidneyKind / CKD Tracker / NephroLog / NephroPulse | iOS | 신장 환자 기록 | 혈관 기능 없음 | 신규, 리뷰 거의 없음 |
| 충칭의대 AVF 추적관리 mHealth 앱 | 병원 도구 | 환자가 스릴·지혈 시간 보고, 이상 시 의료진 연락 | 수술 후 성숙기 정해진 날만, 매회 기록·개인 기준선 추세 없음 | 연구/기관 |
| Fresenius/RRI 동맥류 분류 앱 | 연구 | 스마트폰 혈관 감시, 지혈 지연 기록은 향후 기능 | 사진 기반, 의료진용 | 연구(2020) |
| My Vascular Access | iOS | 투석 혈관 주제 | 의료진 결정보조 | 방치(2021) |
| B. Braun nexadia mobile companion | B2B | 동정맥루 사진 기록 | 직원용 | 활성 |
| Bearable / CareClinic | iOS/Android | 사용자 정의 증상으로 흉내 가능 | 투석 맥락·스톱워치·규칙·진료카드 없음 | 활성 |
| 종이 점검지(NKF, ASDIN, ESRD Network) | PDF | 매일 보고·듣고·만지는 점검 | 디지털 아님, 추세 없음 | 표준 교육자료 |
| 혈관음 AI·웨어러블 연구(KidneyX, Eko, 야마나시대, Sci Rep 2023, npj DM 2023) | 연구 | 조기 감지 목적 | 별도 기기/연구 단계, 상용 환자 앱 없음 | 연구 |
OS·대형 앱 기본 기능으로 해결 가능한가: 부분적으로만(스톱워치+메모+범용 트래커로 수기 가능하나, 투석 회차 연동·개인 기준선 대비 규칙·응급 안내·진료 카드 없음). 사실상 아니오.
판정: DIFFERENTIATED
판정 근거: 혈액투석 환자가 매 투석 지혈 시간과 매일 스릴을 기록해 개인 기준선 대비 추세를 보여주는 공개 앱은 없다. 다만 중국 병원 앱·Fresenius 연구가 개념을 일부 시도했고 범용 트래커로 거칠게 흉내 가능하므로 NOVEL은 아니다. 의료진이 쓰는 이상 신호가 "평소보다"라는 상대 기준이고 환자는 기준선을 기억하지 못한다는 점이 차별점의 가치. 참고: 기존 투석 앱들은 리뷰가 매우 적어(수 개) 환자의 앱 사용 의지가 약하다는 신호일 수 있음.

**market 심사위원이 추가로 찾은 경쟁자·인접 서비스** (같은 Qb 정맥압을 비교하는 환자용 앱은 여전히 없어 판정 유지):
- NephroCare myCompanion (Fresenius, 유럽 투석실 환자용, 회차별 시간·체중·혈압 표시): https://nephrocare.com/en-gb/about-us/news/a-companion-to-your-dialysis-treatment/
- Nx2me (가정 혈액투석, 압력 자동 기록)
- DaVita OneView (의료진용 혈관별 동맥압·정맥압 추세)
- CKD Tracker (iOS, 혈관 메모): https://apps.apple.com/app/id6769186973
- 울산대병원 스마트 홈케어, 대한신장학회 하이디(식이) — 유통 파트너 후보


### 존재 재확인 (2026-11-23 UPGRADE): 혈관수첩 v2 — 시술 후 천자 지도
검색 쿼리 (9개, 모두 이전 기록에 없는 새 쿼리):
1. "dialysis cannulation map app patient track needle sites rope ladder infiltration" — 상용 앱 없음. **환자 휴대폰에 천자 지도·위치 사진을 저장해 간호사에게 보여 준 연구(pjkd4180, 초록): 환자는 천자 개선을 체감하지 못했고 성공은 간호사 숙련도에 달렸다고 응답.** NKF: 침윤은 천자 시도의 5~7%
2. "app for patients after fistulaplasty angioplasty AV fistula follow-up diary" — 환자 앱 없음. PREDICT-AVF(의료진용 웹), NHS 시술 후 종이 안내문(하루 2회 자가 점검)
3. "투석 천자 위치 기록 앱 동정맥루 바늘 위치" — 전용 앱 없음, 천자 간격·재순환 연구만
4. "동정맥루 풍선확장술 후 관리 기록 어플 혈관센터 외래" — 앱 없음. 머니투데이 2026-04, 원주세브란스 접근클리닉 안내
5. "site:apps.apple.com cannulation fistula needle site" — 앱스토어 결과 없음(NKF·BD WavelinQ 교육자료)
6. "\"needle site rotation\" tracker hemodialysis buttonhole log 2026" — 트래커 없음
7. "site:play.google.com dialysis needle site cannulation tracker" — Dialysis Pro, Dialysis Diary, InBioZ, GoCanvas Dialysis Flow Sheet: 천자 위치 기능 없음 (이전 경쟁자 변화 없음)
8. (대체 표현) "\"injection site\" rotation map app body diagram tracker ... OR \"cannulation chart\" app dialysis unit nurses" — **같은 메커니즘의 주사 부위 순환 앱**: Drop: Injection Tracker, OmniSite Tracker, Injection Reminder, 주사 알림 의료 도우미(투석용 아님)
9. "투석혈관 시술 후 다음 외래까지 자가 점검 기록지 혈관 떨림 지혈 기록" — 표준 기록지 없음. 미국 안내: 지혈 30분 초과 시 연락

| 이름 | 플랫폼 | 겹치는 점 | 다른 점 | 상태 |
|---|---|---|---|---|
| Drop / OmniSite Tracker / Injection Reminder | iOS | 신체 그림 위 부위 순환·휴식 표시 | 피하주사용, 천자 결과·시술 기간·외래 요약 없음 | 활성 |
| 휴대폰 천자 지도 연구 (pjkd4180) | 연구 | 환자 폰의 천자 위치를 간호사에게 보여 줌 | 사진만, 결과 기록 없음. 환자 체감 효과 없음 | 연구 |
| 투석실 종이 천자 기록지 / NKF 체크리스트 | 종이 | 천자 위치 기록 | 기관 내부 | 일부 기관 |
| Dialysis Pro 외 투석 앱 | iOS/Android | 투석 기록 | 천자 위치 없음 | 활성 |
OS·대형 앱 기본 기능으로 해결 가능한가: 부분적으로(사진+메모, 주사 부위 앱 변형). 시술 기간 요약은 없음.
판정: DIFFERENTIATED — 환자가 회차별 천자 결과를 쌓아 다른 기관(혈관센터)으로 들고 가는 앱은 찾지 못함. 다만 메커니즘은 주사 부위 앱에 있고 환자 쪽 천자 지도의 무효과 반증이 있음.

**market 심사위원이 추가로 찾은 경쟁자 (2026-11-23)**:
- **Electronic Cannulation Atlas** (중국 Xuetoutong 시스템 모듈, 간호사용) — https://dovepress.com/the-effectiveness-of-electronic-cannulation-atlas-in-patients-with-art-peer-reviewed-fulltext-article-IJGM (PMC11268560). 혈관 사진 위에 천자 순서를 정하고 회차별 위치·각도·합병증을 기록, 다음 위치를 제안. 92명 6개월 연구에서 협착·혈종·혈전·천자 실패 유의 감소. 핵심 기능 1과 거의 같은 메커니즘이나 **기관 내부 간호사 도구**
- 환자 손그림 '스티킹 맵'(Home Dialysis Central) — https://www.homedialysis.org/news-and-research/blog/187-self-cannulation-a-sticking-point
- 위협은 대형 플랫폼이 아니라 국내 투석 EMR(비트컴퓨터·유비케어 등)의 천자 위치 필드 추가

**재판정**: DIFFERENTIATED 유지(근거 약화). 아틀라스는 같은 메커니즘이지만 기관 안에 갇힌 간호사 도구이고, 환자가 기관 사이(투석실 → 혈관센터)로 운반하는 형태는 여전히 없다. 결론: **"천자 지도" 자체는 차별점이 아니고, 차별점은 '기관 사이 운반'뿐**이다. 다음 업그레이드에서 이 점을 핵심으로 세우지 못하면 EXISTS 쪽으로 보는 것이 맞다.

## 4. 비판 검증 결과 (최근 심사 = 2026-11-23 UPGRADE 재심사, v2 후보)
| 심사위원 | 점수 (직전) | 판정 | 핵심 비판 |
|---|---|---|---|
| user-reality | 3 (2) | REVISE | 간호사에게 "C구역 6회 중 5회"를 보여 주는 건 사실상 지적이라 환자가 꺼내지 않음. 테이프·담요 아래 바늘을 고령 환자가 구역으로 정확히 탭하기 어렵고, 결과 대부분이 '한 번에'라 정보량 부족. 첫 설정을 다른 기관인 투석실 간호사에게 기대야 해서 이탈 |
| creativity | 3 (3) | REVISE | 주사 부위 순환 앱의 투석판. 핵심 장면이 효과 없었던 pjkd4180 연구와 같음. 진짜 새로운 건 '기관 사이 정보 단절을 환자 폰이 잇는 것'인데 부수 기능에 머묾 → **시술 의사가 QR에 '찌르지 말 구간'을 담아 투석실로, 투석실 결과를 외래로 나르는 양방향 천자 처방전**으로 뒤집으라 |
| market | 3 (2) | REVISE | 놓친 경쟁자 Electronic Cannulation Atlas(간호사용, 효과 근거 있음) — 같은 메커니즘은 간호사 쪽에서 효과, 환자 쪽에서 무효과. 실사용 연 300~600명 추정(v1보다 작음). 혈관센터 배포 유인·의사 열람 근거 없음 |
| feasibility | 4 (4) | PASS(조건부) | 4~6구역은 rope-ladder(1~2cm)와 반복 천자를 구별 못 함 → 1.5cm 간격 번호 단(rung) 모델. 구역 설정 편집기가 가장 어려움(7~10일). QR 설치 후 deferred deep link는 서버 없이 불가 → 앱 안 재스캔. PDF에 녹음 불가. 위젯·녹음 v1.1로 미루면 5~6주 |
| business | 3 (3) | REVISE | 이익(혈관센터)·노동(환자)·설정(투석실 간호사)이 분리. 장비사 후원은 DCB 급여 구간과 겹쳐 공정경쟁규약 리스크. 퍼널 7.5% → 활성 1,000명에 안내문 1.3만 장 필요. 반복 시술 주기와 맞는 재활성화 구조는 긍정 |
| risk | 3 (4) | REVISE | 날짜·구역별 재천자·침윤 기록이 다른 기관으로 가면 투석실에는 '간호사 실패 기록'으로 읽힘(분쟁 자료화, 환자 불이익). 부정확한 자가기록이 천자 위치 결정 근거가 되는 비대칭 위험. 장비사 후원 리베이트 소지, '침윤 의심' 라벨, 떨림 없음 긴급도 분리 필요 |

평균 **3.17** (직전 3.00, +0.17), KILL 0, creativity 3·user-reality 3 → 통과 기준(평균 ≥ 3.5) 미달.
market 추가 경쟁자로 존재 확인 재판정 → DIFFERENTIATED 유지(3절 참고).

### 직전 비판 해소 여부 (심사위원 RESOLVED 종합)
| 직전 비판 | UR | C | M | F | B | R |
|---|---|---|---|---|---|---|
| 1. 투석실 기록과 중복, 정보량, 리텐션 | 부분 | 부분 | 부분 | 해소 | 부분 | 해소(새 문제 발생) |
| 2. 숫자 옮겨 적기, 낡은 방법 | 부분 | 부분 | 해소 | 해소 | 해소 | 해소 |
| 3. 유통 유인, 알림, 보호자 링크 모순 | 부분 | 부분 | 부분 | 해소/부분 | 부분 | 부분 |

### v1.1에 반영한 유효한 개선 (심사위원 다수가 실질 대응으로 인정)
- 투석기 숫자 입력 삭제, 대상을 시술 후 환자로 좁히고 '다음 외래까지' 끝이 있는 기간 한정 과제로 전환 (리텐션 구조 개선, 반복 시술 주기와 맞는 재활성화)
- exact alarm 미사용, 보호자 링크 삭제 (기술 모순 해소)
- risk 제안: '떨림 없음' 긴급 등급 분리, GPS 없는 응급 링크, 사실 라벨("멍·부음"), PDF 사진 제외·면책 문구, 장비사 후원 보류
- feasibility 제안: 앱 안 QR 재스캔 설정, 버튼홀 환자 제외

### 해소되지 않은 리스크
- **천자 지도의 효과 반증**: 환자 쪽 천자 지도는 무효과(pjkd4180), 간호사 쪽은 효과(Electronic Cannulation Atlas). 환자 앱이 왜 다를지 설명 없음
- **투석실과의 관계**: 기록이 '간호사 실패 기록'으로 읽힐 위험, 첫 설정을 누가 하는지
- **혈관센터 수요 미검증**: 의사가 외래 5분 안에 요약을 보고 판단을 바꾸는지, QR 배포를 승인할지
- 시장 규모: 연 실사용 수백 명 수준일 수 있음

## 5. 실행 계획 (단계 0 — 다음 업그레이드가 마지막 기회)
다음 업그레이드 방향 (심사위원 제안이 모인 지점):
1. **컨셉을 '양방향 천자 처방전'으로 뒤집기** (creativity·business·user-reality·feasibility 공통): 시술 의사·코디네이터가 퇴원 때 30초 안에 접근로 템플릿·천자 구간 양 끝·"N주간 피할 구간"·센터 번호를 QR에 담아 줌(서버 없음, QR 페이로드). 투석실 화면은 "환자 기억"이 아니라 "시술한 선생님이 이 구간은 피하라고 했어요" + "지난 2회 위치" 카드만. 횟수 통계는 외래 요약에만
2. **결과 먼저, 위치는 문제 회차에만**: 결과 원탭 → 재천자·멍·지혈 오래일 때만 1.5cm 번호 단 위치를 묻고 '모름' 허용
3. **선택 기능 '간호사 확인 기록'**: 간호사가 원하면 2탭으로 구역·결과 확인 → 자가보고가 아닌 현장 기록 운반. 간호사 이름·근무 식별 칸은 만들지 않음, 요약은 날짜 없이 '혈관 반응' 구역 합계 옵션
4. 외래 요약을 DCB 급여 판단 구간(시술 후 3개월)의 타임라인으로 설계해 혈관센터의 기록 부담을 직접 줄임 (장비사 후원과 분리)
5. 혈관음 녹음 제거 또는 v1.1 이후로
- 기술: Flutter, 로컬 DB + 암호화 백업, 앱 안 QR 스캔, MVP 5~6주(위젯·녹음 제외)
- 수익: 1단계 무료·서버 없음·후원 없음(운영비 연 수십만 원) → 2단계 기관 로고 요약 양식(B2B)·학회 환자교육 연계
- 가설 검증 실험(만들기 전):
  - 혈관센터 의사 3명에게 요약 목업을 보여 주고 "초음파 부위·재시술 판단이 바뀌는가" 질문 (성공: 3명 중 2명 이상 구체적 사례로 '예')
  - 투석실 간호사 5~10명 인터뷰: "시술 의사의 피할 구간 표시를 참고하겠는가, 결과 기록이 부담스러운가" (성공: 과반이 참고 의향, 부담 낮음)
  - 종이 시제품 20명 × 8주: 기록 완료율 50% 이상, 환자 위치 기록과 간호사 확인 일치율 80% 이상
  - 심평원 수가코드로 국내 연간 투석혈관 중재 실환자 수 확인 (2만 명 이상이면 유지)

## 6. 단계별 산출물
(단계 1 통과 후 추가)

## 7. 버전 이력
| 버전 | 날짜 | 단계 | 평균 | 핵심 변경 | 해소된 비판 | 남은 리스크 |
|---|---|---|---|---|---|---|
| v1 | 2026-11-22 | 0 | 3.17 → 3.00 | 최초 기획 + 개선 라운드(기록 시점 이동, Qb·VP 기준선, 판정 제거) | 양손이 묶임, 매일 체크 피로, 의료기기 경계 일부 | 투석실 기록과 중복, 수요·유통, 정맥압 잡음 |
| v2 (시도 실패) → v1.1 | 2026-11-23 | 0 (유지) | 3.17 | 대상을 시술 후 8~12주 환자로 좁히고 천자 지도(구역 탭 + 결과)를 핵심으로, 혈관센터 QR 유통. 심사 미달(평균 3.17 < 3.5)로 단계 유지·정체 +1, 유효한 개선(숫자 삭제, 기간 한정, 알림·보호자 링크 정리, 위험 라벨)만 v1.1에 반영 | 숫자 옮겨 적기, 알림 취약, 로컬·보호자 링크 모순 | 환자 쪽 천자 지도 무효과 반증, 간호사용 Electronic Cannulation Atlas, 투석실 관계·책임, 혈관센터 수요, 시장 연 수백 명 |
| v3 (시도 실패) | 2026-11-23 | 0 → DROPPED | 3.17 | 양방향 천자 처방전(시술 의사 QR 발급 → 투석실 카드 → 외래 요약) | 환자 기억 기반 천자 지도의 효과 반증(부분), 투석실 첫 설정 부담 | 지시 내용 자체가 드묾, 종이·회신서 대체, QR 진위, 준수 여부=감사 기록 → 정체 2로 중단 |

## 부록: v3 업그레이드 시도 (2026-11-23, DROPPED)

### 시도한 변경 (v3 — 양방향 천자 처방전)
- 정보 출처를 환자 기억에서 시술 의사 지시로 뒤집음: 의료진용 정적 웹 발급기(서버 없음)에서 혈관 템플릿 위 '시술 구간·N주간 피할 구간·권장 구간'을 QR로 발급 → 환자 폰이 투석실로 운반 → 투석실 화면엔 지시 카드와 지난 2회 위치만(통계 없음), 기간 만료 자동
- 결과 먼저·문제 회차에만 1.5cm 번호 단 위치, 선택 '간호사 확인', 외래 요약은 날짜 없는 구간 합계 옵션, 장비사 후원 삭제

### 존재 재확인 (U3, 8개 쿼리, 그중 6개 새 쿼리)
1. "vascular access center to dialysis unit handoff communication cannulation instructions after angioplasty patient-held" (새) — 인계 도구·환자 보유형 지시 문서 없음. NKF 천자 체크리스트, FistulaFirst "신규 AVF 천자 프로토콜은 시술의 포함 팀이 작성", 호주 지침 "수술기록의 시술 후 지시 확인"
2. "\"fistula passport\" OR \"vascular access passport\" dialysis patient" (대체 표현, 새) — 해당 프로그램·앱 없음
3. "투석혈관 시술 후 투석실 전달 천자 피할 부위 의사소통" (새) — 국내 인계 절차 자료 없음
4. "동정맥루 시술 결과 투석실 공유 앱 QR 천자 지시" (새) — 앱·QR 체계 없음
5. "site:apps.apple.com vascular access dialysis cannulation" — My Vascular Access(의료진·방치), VeinTrain, CVR Calc, AngioDynamics, Precision Nurse — 해당 없음
6. "app interventional nephrologist share access map with dialysis nurses cannulation zone 2026" (새) — Electronic Cannulation Atlas 외 없음
7. "site:play.google.com hemodialysis fistula patient app" — Dialysis Pro, Abdelrasoul Dialysis, DiPA, 터키 교육앱 임상시험, nexadia — 변화 없음
8. "투석 전자의무기록 천자 기록 기능 혈관 지도 투석실 프로그램" (새) — 국내 투석 EMR 천자 지도 공개 자료 없음

market 심사위원이 추가로 찾은 대체재: Ottawa 시술 의뢰·시술 후 투석 오더 지침(https://kcr.csnscn.ca/search-by-keyword/hemodialysis/vascular-access/misc-vascular-access/500-ottawa-guidelines-for-accepting-patients-requiring-vascular-access-interventions-mar-2018/file), NHS Scotland "I have a fistula" 환자 카드(https://rightdecisions.scot.nhs.uk/media/qgtp2r43/dialysis-patient-card_i-have-a-fistula.pdf), UNC Save the Vein 지갑 카드, Niagara Health PowerChart 투석 접근로 양식, 국내 진료의뢰·회송 회신서(팩스·카톡 사진). PTA 후 "바로 사용 가능" 안내(Guy's and St Thomas', UMM Health).
판정: DIFFERENTIATED 유지(근거 더 약화) — 구간 지시를 기관 사이로 운반하는 도구는 없으나, 종이 카드·회신서가 실질 대체재이고 지시 내용 자체가 드묾.

### 재심사 결과 (v3)
| 심사위원 | 점수 (직전) | 판정 | 핵심 비판 |
|---|---|---|---|
| user-reality | 3 (3) | REVISE | 일반 PTA 후 'N주간 피할 구간' 표준 근거 없음 → 의사가 칸을 비우거나 '제한 없음' 발급. 간호사는 cm 줄자가 아니라 촉지·피부 표시로 정함. 외래 요약 '지시 준수 여부'가 투석실 감사 기록 |
| creativity | 3 (3) | REVISE | 환자 보유형 기관 간 기록+QR은 산모수첩·회송서와 같은 구조. 새로운 부분(만료 지시)은 종이로 충분, 앱이 필요한 부분(회차 기록)은 반증된 메커니즘 → 팔 사진 위에 그린 만료 지시 + 만료 시 1회 회신 제안 |
| market | 3 (3) | REVISE | PTA 후 바로 사용 안내가 흔해 지시가 의미 있는 경우는 신규 AVF·혈전제거·스텐트그라프트로 좁음 → 연 500~1,000명. 회신서가 최강 대체재, 투석실이 적대할 유인 |
| feasibility | 4 (4) | PASS | 서명 없는 정적 발급기라 QR 진위 확인 불가(Ed25519 서명+내장 공개키로 해결 가능). 망분리 PC·EMR 밖 작업. cm 좌표계와 rung 정합이 가장 어려움. MVP 4~6주 가능 |
| business | 3 (3) | REVISE | 발급 노동에 수가 0, 병원 서식 승인·망분리 장벽. 종이만으로 1번 문제 해결 → 앱은 빠지기 쉬운 고리. B2B 구독 상한 작음, 무료 공익 도구로 확정하라 |
| risk | 3 (3) | REVISE | 누구나 위조 가능한 QR이 '○○병원 지시'로 표시 → 권위 달린 오정보. '처방전' 명칭 의료법상 오인. 좌·우·AVG limb 오입력, 다른 환자 QR 스캔. '지시 준수 여부'는 위반 기록 |

평균 **3.17** (직전 3.17, ±0), KILL 0, creativity 3·user-reality 3 → 통과 기준 미달.
RESOLVED 종합: 비판 1(환자 쪽 천자 지도) 해소 2·부분 4, 비판 2(분쟁 자료화) 부분 6, 비판 3(유통 유인) 부분 6.

### 상태 전이 (pipeline.md 기계 적용)
- `pass` 아님, 3.0 ≤ 3.17 < 3.5, KILL 0 → 유지 + 정체 1→2
- 정체 ≥ 2 → **DROPPED (정체)**, 또한 '단계 0 상태로 업그레이드 2회 실패' 규칙에도 해당

## 부록: 발산 기록 (2026-11-22 22:31 UTC NEW)
- **D1 도메인**: 혈액투석 환자의 일상 (투병 중 가족 간병 — 투석)
- **D2 현장 조사 검색**: "혈액투석 환자 수분 제한 힘든점 카페", "reddit dialysis \"I wish there was an app\"", "hemodialysis patient daily struggles fluid restriction thirst reddit", "투석 환자 보호자 고민 칼륨 음식 외식 어려움", "dialysis app reviews fluid tracker complaints kidney diet app 1 star", "투석 환자 여행 투석 예약 원정투석 불편 2026", "투석 동정맥루 진동 확인 매일 막힘 조기 발견 환자 경험", "dialysis patient post-treatment fatigue washed out ride home caregiver forum", "phosphate binder forgot with meal dialysis patients adherence snacks eating out", "투석 환자 가족 단톡방 투석 일정 공유 이송 보호자 지침" (10회)
- **페인 포인트 (14개)**:
  1. 갈증: 혈액투석 환자의 67~97%가 겪음, 물 제한을 지키기 어려움 (PMC12786103, 브런치 체험기) — 매일
  2. 투석 사이 체중 증가 목표(하루 1kg 이하) 관리 (NKF) — 매일
  3. 수분 앱의 불만: 지난 기록을 소급 입력 못 함, 매일 초기화, 업데이트 후 데이터 소실 (H2O Overload, Dialysis Pro 리뷰) — 매일
  4. 칼륨·인 음식 검색이 불편 (KidneyDiet 리뷰) — 매일
  5. 인결합제를 잊음, 특히 외식·간식 때, 약이 커서 들고 다니기 어려움 (DaVita) — 매일
  6. 스릴 자가 점검을 하라고 하지만 '평소'를 비교할 기준이 없음, 지혈 지연이 협착 신호 (데일리메디, Fistula First) — 주 3회·매일
  7. 3~6개월마다 혈관 정기 검진 (스포츠경향) — 드묾
  8. 투석 후 피로가 집에서 가장 심한데 의료진은 이를 보지 못함 (NIDDK, 환자의 약 절반) — 주 3회
  9. 통원 이동: 약 1/3은 차량 없이 통원 불가, 투석실 차량 지원은 '환자 유인'으로 제재 (메디칼타임즈, 데일리메디) — 주 3회
  10. 고령 환자는 투석이 5시간 걸리고 식사 해결이 어려움 (데일리메디 2026-08) — 주 3회
  11. 여행지 투석 예약 (NKF) — 드묾
  12. 빠진 투석을 다시 잡는 일 (Healio 2026-10) — 월간
  13. 재난 대비: 예비 투석센터·연락 담당자 지정 (NYC 가이드) — 드묾
  14. 보호자 부담이 정책 논의에서 빠져 있음 (다음 기사) — 주간
- **D3 후보 15**: ①지혈 시간 로그 ②혈관음 녹음 비교 ③투석 간격 기준 물 예산 위젯 ④긴 간격(금→월) 경보 ⑤갈증 순간 대체 행동 ⑥식당 지오펜스 인결합제 알림 ⑦투석 후 귀가 체크인 ⑧투석 후 회복 시간 원탭 기록 ⑨같은 반 동행 매칭 ⑩투석실 식사 해결 ⑪여행지 투석 빈자리 찾기 ⑫투석 종료 Live Activity 가족 픽업 ⑬칼륨 음식 사진 판별 ⑭체중계 사진 → 물 예산 ⑮투석 팔 보호 알림 (+⑯가족 당번 ⑰재난 대비 카드)
- **D4 제거**: ⑬(30초 안에 떠올릴 AI 래퍼) ⑪⑰(드묾) ⑮(가치 낮음) ⑤(통찰 약함) ④⑭(③에 흡수) ⑩(앱 문제 아님) ⑯(탈락한 안부릴레이와 같은 메커니즘). 남은 8개: ①②③⑥⑦⑧⑨⑫
- **D5 사전 검색 (16회)**: ① 통과(전용 앱 없음) ② 통과(연구만 있음: Sci Rep 2023, npj DM 2023) ③ 사전 EXISTS(H2O Overload, FiApp, Dialysis Pro의 수분 목표) ⑥ 통과(일반 Geo Reminder만 있음, 통찰 약함) ⑦⑫ 통합 후 통과 ⑧ 부분 겹침(Today Energy Check) ⑨ 통과
- **D6 상위 3**: A 투석혈관 일지(①+② 통합, 3×3×2=18), B 투석 픽업 라이브(⑦+⑫, 2×3×3=18), D 투석길동무(⑨, 2×3×2=12). 예비: ⑥(9), ⑧(6)

## 부록: 탈락한 후보
| 후보 | 탈락 단계 | 사유 |
|---|---|---|
| B 투석 픽업 라이브 ("끝났어요") | 존재 확인 | EXISTS — 카카오톡 한 줄, Apple Check In, Life360 지오펜스, PingRoom·OneTap Safe(잠금화면 상태 공유), Hitch Health "READY" 패턴. 빈 영역은 투석 후 회복 시간 기록뿐 |
| D 투석길동무 (같은 반 동행 매칭 → 보호자 당번 품앗이) | 비판 검증 | 1차 2.33(UR2·C3·M2·F3·B2·R2), 개선 2.50(UR2 KILL·C2·M2·F4·B2·R3). 카톡 단톡방과 간호사 소개로 대체됨, 반당 밀도 0~1조. market이 Kid Hop·Carpool Scheduler·Carpool-Kids·GoKid·Lotsa Helping Hands를 찾아내 EXISTS로 재판정 |
| ③ 투석 간격 기준 물 예산 | 사전 검색 | H2O Overload, FiApp, Dialysis Pro |
| ⑥ 식당 지오펜스 인결합제 알림 | D6 순위 밖 | 통찰 약함(일반 위치 알림으로 대체 가능) |
| ⑧ 투석 후 회복 시간 기록 | D6 순위 밖 | Today Energy Check와 부분 겹침, 모바일 고유성 낮음 |
