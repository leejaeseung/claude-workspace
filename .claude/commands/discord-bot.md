# Discord Bot 관리

Discord Bot을 시작, 중지, 재시작하고 상태를 확인합니다.

## 명령어 목록

### 상태 확인
```bash
ps aux | grep "node index.js" | grep -v grep && echo "✅ Bot 실행 중" || echo "❌ Bot이 실행 중이지 않습니다"
```

### Bot 시작
```bash
cd /mnt/c/Users/wasd2/claude-workspace/discord-bot && nohup npm start > bot.log 2>&1 &
sleep 2
ps aux | grep "node index.js" | grep -v grep && echo "✅ Bot 시작됨" || echo "❌ Bot 시작 실패"
```

### Bot 중지
```bash
pkill -f "node index.js"
sleep 1
ps aux | grep "node index.js" | grep -v grep && echo "❌ Bot 중지 실패" || echo "✅ Bot 중지됨"
```

### Bot 재시작
```bash
pkill -f "node index.js" 2>/dev/null
sleep 2
cd /mnt/c/Users/wasd2/claude-workspace/discord-bot && nohup npm start > bot.log 2>&1 &
sleep 3
ps aux | grep "node index.js" | grep -v grep && echo "✅ Bot 재시작 완료" || echo "❌ Bot 재시작 실패"
```

### 로그 보기
```bash
tail -50 /mnt/c/Users/wasd2/claude-workspace/discord-bot/bot.log
```

## 사용 예시

Bot 상태 확인하기:
```
/discord-bot status
```

Bot 시작하기:
```
/discord-bot start
```

Bot 재시작하기:
```
/discord-bot restart
```
