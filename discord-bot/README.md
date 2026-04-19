# Discord ↔ Claude Code Bot

로컬 PC에서 실행되는 Claude Code를 Discord 모바일을 통해 제어합니다.

## 설치

### 1. Discord Bot 생성
1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. "New Application" 클릭 → Bot 이름 입력
3. "Bot" 메뉴 → "Add Bot" 클릭
4. "TOKEN" → "Copy" (아래 `.env` 파일에 붙여넣기)
5. "Intents" 활성화:
   - MESSAGE CONTENT INTENT ✅
6. "OAuth2" → "URL Generator" 선택:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Message History`
7. 생성된 URL을 복사해서 브라우저에서 서버에 Bot 초대

### 2. 환경 설정
```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
DISCORD_TOKEN=your_bot_token_here
ALLOWED_USER_IDS=123456789,987654321  # 당신의 Discord User ID
ALLOWED_CHANNEL_IDS=                  # 비워두면 모든 채널 허용
CLAUDE_PATH=/home/wasd222/.local/bin/claude
COMMAND_PREFIX=!c
```

**당신의 Discord User ID 찾기:**
- Discord 설정 → Advanced → Developer Mode 활성화
- 프로필 오른쪽 클릭 → "Copy User ID"

## 실행

```bash
# 포그라운드에서 실행
node index.js

# 백그라운드 실행 (WSL)
nohup node index.js > bot.log 2>&1 &
```

## 사용 방법

### Discord에서 명령하기

**DM으로 사용:**
```
@Bot 파이썬으로 피보나치 함수 짜줘
```

**채널에서 명령:**
```
!c 현재 시간이 몇 시야?
!c src/main.py 파일 읽고 버그 찾아줘
```

### 응답

Claude Code의 응답이 Discord로 전송됩니다.
- 2000자 초과 시 자동 분할
- 타이핑 인디케이터 표시 중

## 기능

✅ 로컬 Claude Code CLI 실행  
✅ Discord DM 및 채널 지원  
✅ 유저/채널 화이트리스트 보안  
✅ 대용량 응답 분할 전송  
✅ 타임아웃 보호  

## 문제 해결

**Bot이 시작되지 않음:**
```bash
# 포트 확인
netstat -tulpn | grep node

# 로그 확인
tail -f bot.log
```

**Claude가 실행되지 않음:**
```bash
# Claude CLI 경로 확인
which claude
/home/wasd222/.local/bin/claude --version

# .env의 CLAUDE_PATH 확인
```

**Bot이 메시지를 받지 못함:**
1. Bot이 채널에 권한이 있는지 확인
2. MESSAGE CONTENT INTENT 활성화 여부 확인
3. 유저 ID가 ALLOWED_USER_IDS에 포함되어 있는지 확인

## 로그 확인

```bash
# 실시간 로그 보기
tail -f bot.log

# 마지막 100줄 보기
tail -100 bot.log
```

## 중지

```bash
# 백그라운드 프로세스 찾기
ps aux | grep "node index.js"

# 프로세스 종료
kill <PID>
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DISCORD_TOKEN` | Discord Bot Token | 필수 |
| `ALLOWED_USER_IDS` | 허용할 Discord User ID (쉼표 구분) | 모두 허용 |
| `ALLOWED_CHANNEL_IDS` | 허용할 채널 ID (쉼표 구분) | 모두 허용 |
| `CLAUDE_PATH` | Claude CLI 경로 | `/home/wasd222/.local/bin/claude` |
| `COMMAND_PREFIX` | 명령 prefix | `!c` |
| `RESPONSE_TIMEOUT` | Claude 타임아웃 (ms) | `30000` |
