# Discord Bot 프로젝트

Discord ↔ Claude Code 연동 Bot 프로젝트입니다.

## 커스텀 명령어

### /hr-hire
HR 팀의 채용 프로세스를 관리합니다. (3단계 검증 + 팀 리더 평가 참여)

**중요**: 모든 채용 에이전트는 프로젝트 레벨로 등록됩니다.
- 위치: `.claude/agents/<팀명>-<역할명>.md`
- 예시: `.claude/agents/code-quality-leader.md`

사용법:
```bash
/hr-hire <팀명> <역할명> - <역할 요건 설명>
```

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

---

## HR 채용 프로세스 (팀 리더 평가 참여)

Jason Company의 엄격한 채용 프로세스입니다. **hr-chief + 3명 평가자(hr-evaluator-1/2/3) + 채용 대상 팀 리더**가 협력합니다.

### 주요 특징

✨ **팀 리더 평가 참여**:
- 각 검증 단계에서 팀 리더의 관점 평가 통합
- 팀 문화 적합성, 실무 협업 능력, 기술 실무 관련성 중점 평가
- 팀 리더의 의견을 최종 판정에 동등한 비중으로 반영

✨ **3단계 검증 (70점 → 75점 → 80점)**:
- 1차: 서류 심사 (평균 70점 이상)
- 2차: 실무 능력 테스트 (평균 75점 이상)
- 3차: 심층 인터뷰 (평균 80점 이상)

✨ **투명한 의사결정**:
- 모든 단계에서 명확한 기준 제시
- 평가자 의견 불일치 시 근거 분석 및 문서화
- 조건부 채용 시 조건을 명확히 명시

### 상세 프로세스

**전체 프로세스 가이드**는 → [`HR_HIRING_PROCESS.md`](./HR_HIRING_PROCESS.md) 참고

**주요 단계**:
1. 사전 준비 (평가 기준표, 후보 프로필)
2. 1차 검증 (기술, 커뮤니케이션, 창의성 + 팀 리더 평가)
3. 2차 검증 (실무 시나리오 기반 평가)
4. 3차 검증 (심층 인터뷰)
5. 최종 결정 및 에이전트 파일 생성

---

## Agent 저장 정책

### 프로젝트 레벨 에이전트 등록

**원칙**: Jason Company 내에서 채용되는 모든 에이전트는 **프로젝트 레벨**에 등록합니다.

**저장 위치**:
```
.claude/agents/<팀명>-<역할명>.md
```

**현재 등록된 에이전트**:

| 에이전트 | 파일명 | 역할 | 상태 |
|---------|--------|------|------|
| hr-chief | `.claude/agents/hr-chief.md` | 채용 의사결정 | ✅ 활성 |
| hr-evaluator-1 | `.claude/agents/hr-evaluator-1.md` | 기술역량 평가 | ✅ 활성 |
| hr-evaluator-2 | `.claude/agents/hr-evaluator-2.md` | 커뮤니케이션 평가 | ✅ 활성 |
| hr-evaluator-3 | `.claude/agents/hr-evaluator-3.md` | 창의성 평가 | ✅ 활성 |
| **code-quality-leader** | **`.claude/agents/code-quality-leader.md`** | **Code Quality 리더** | **✅ 활성** |

### Global Agent 정책

- **Global agent 저장 금지**: 조직 고유 에이전트는 global에 저장하지 않음
- **유지보수**: 프로젝트 내 에이전트만 버전 관리 대상
- **이유**: Jason Company의 채용 의사결정과 조직 문화를 명확히 구분
