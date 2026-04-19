# Discord Bot 프로젝트

Discord ↔ Claude Code 연동 Bot 프로젝트입니다.

## 커스텀 명령어

### /discord-bot
Discord Bot을 관리합니다.

실행 예시:
```bash
/discord-bot start     # Bot 시작
cd /mnt/c/Users/wasd2/claude-workspace/discord-bot && nohup npm start > bot.log 2>&1 &
```

```bash
/discord-bot stop      # Bot 중지
pkill -f "node index.js"
```

```bash
/discord-bot restart   # Bot 재시작
pkill -f "node index.js" && sleep 2 && cd /mnt/c/Users/wasd2/claude-workspace/discord-bot && nohup npm start > bot.log 2>&1 &
```

```bash
/discord-bot status    # Bot 상태 확인
ps aux | grep "node index.js" | grep -v grep && echo "✅ Bot 실행 중" || echo "❌ Bot이 실행 중이지 않습니다"
```

```bash
/discord-bot logs      # Bot 로그 보기
tail -50 /mnt/c/Users/wasd2/claude-workspace/discord-bot/bot.log
```
