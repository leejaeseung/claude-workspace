import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { TEAM_COLORS } from '../types'
import type { Agent } from '../types'

interface Props {
  agents: Agent[]
  selectedAgentId: string | null
  onSelectAgent: (id: string) => void
}

const AGENT_PRESETS: Record<string, string[]> = {
  'code-quality-leader': ['ARB 의사결정 기준 설명해줘', '코드 품질 현황 점검해줘', '이번 분기 KPI 달성 현황 보고해줘'],
  'code-quality-oop-patterns-expert': ['GoF 패턴 채택 기준 설명해줘', '현재 코드베이스 패턴 분석해줘', 'Arrow-kt Either 활용법 알려줘'],
  'code-quality-refactoring-specialist': ['Strangler Fig 패턴 적용 계획 수립해줘', '리팩토링 범위 산정해줘', '현재 기술 부채 목록 점검해줘'],
  'code-quality-test-engineer': ['테스트 커버리지 현황 보고해줘', 'Flaky 테스트 분류 기준 설명해줘', 'Golden Master 테스트 전략 수립해줘'],
  'feature-develop-leader': ['이번 스프린트 OKR 점검해줘', '팀 기술 선택 방향 보고해줘', 'Arrow-kt 파일럿 결과 공유해줘'],
  'feature-develop-developer-1': ['담당 도메인 구현 현황 보고해줘', 'Rule of Three 적용 사례 공유해줘', '기술 부채 현황 알려줘'],
  'feature-develop-developer-2': ['Kafka 이벤트 설계 검토해줘', 'ADR 작성해줘', 'JVM/GC 튜닝 현황 보고해줘'],
  'hr-chief': ['현재 채용 진행 현황 보고해줘', '평가 기준 검토해줘', '조건부 채용 모니터링 현황 알려줘'],
  'agent-supervisor': ['전 팀 성과 현황 보고해줘', '팀 간 이슈 점검해줘', '이번 분기 시스템 개선 사항 보고해줘'],
}

const WS_STATUS_STYLE = {
  connected: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'CONNECTED' },
  connecting: { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'CONNECTING...' },
  disconnected: { dot: 'bg-red-500 animate-pulse', text: 'text-red-400', label: 'DISCONNECTED' },
}

/** 대기 중 진행 표시: 점 3개 순환 + 경과 시간 */
function WaitingIndicator({ agentName, color }: { agentName: string; color: string }) {
  const [elapsed, setElapsed] = useState(0)
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((s) => s + 1)
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const phases = [
    { at: 0, msg: '명령 전달 중' },
    { at: 3, msg: '에이전트 초기화 중' },
    { at: 6, msg: '컨텍스트 분석 중' },
    { at: 12, msg: '응답 생성 중' },
    { at: 20, msg: '응답 작성 중' },
  ]
  const phase = [...phases].reverse().find((p) => elapsed >= p.at) ?? phases[0]

  return (
    <div className="flex flex-col gap-2 py-2">
      {/* 에이전트 이름 + 상태 */}
      <div className={`font-mono text-xs ${color}`}>
        [{agentName}] {phase.msg}{dots}
      </div>

      {/* 프로그레스 바 (무한 순환) */}
      <div className="relative h-1 bg-slate-800 rounded-full overflow-hidden w-48">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-emerald-500"
          style={{
            animation: 'progress-slide 1.5s ease-in-out infinite',
            width: '40%',
          }}
        />
      </div>

      {/* 경과 시간 */}
      <div className="font-mono text-[10px] text-slate-600">
        {elapsed}s 경과 · Ctrl+Enter 입력 불가 (응답 대기 중)
      </div>
    </div>
  )
}

export function CommandConsole({ agents, selectedAgentId, onSelectAgent }: Props) {
  const [input, setInput] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const { sendCommand, abortCommand, resetSession } = useWebSocket()
  const { streams, waiting, consoleHistory, clearStream, wsStatus, setPermissionModalAgentId, agentPermissions } = useStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)
  const stream = selectedAgentId ? streams[selectedAgentId] : null
  const isWaiting = selectedAgentId ? (waiting[selectedAgentId] ?? false) : false
  const isStreaming = stream?.isStreaming ?? false
  const isBusy = isWaiting || isStreaming
  const statusStyle = WS_STATUS_STYLE[wsStatus]
  const presets = selectedAgentId ? (AGENT_PRESETS[selectedAgentId] ?? []) : []
  const colors = selectedAgent ? TEAM_COLORS[selectedAgent.team] : null
  const hasHistory = selectedAgentId
    ? consoleHistory.some((h) => h.agentId === selectedAgentId)
    : false

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [stream?.chunks, isWaiting])

  const handleExecute = () => {
    if (!selectedAgentId || !input.trim() || wsStatus !== 'connected' || isBusy) return
    const cmd = input.trim()
    useStore.getState().addConsoleEntry(selectedAgentId, cmd)
    clearStream(selectedAgentId)
    sendCommand(selectedAgentId, cmd)
    setInput('')
    setShowPresets(false)
  }

  const handleStop = () => {
    if (!selectedAgentId) return
    abortCommand(selectedAgentId)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleExecute()
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="font-mono text-xs text-slate-400 tracking-widest">COMMAND CONSOLE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
          <span className={`font-mono text-[10px] tracking-widest ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* 연결 끊김 배너 */}
      {wsStatus === 'disconnected' && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30">
          <span className="text-red-400 text-xs font-mono">
            ⚠ 서버 연결이 끊겼습니다. 자동 재연결 중...
          </span>
        </div>
      )}

      {/* Agent selector */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <span className="font-mono text-xs text-slate-500">AGENT:</span>
        <select
          value={selectedAgentId ?? ''}
          onChange={(e) => onSelectAgent(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-sm text-slate-100 focus:outline-none focus:border-slate-400"
        >
          <option value="">-- 에이전트 선택 --</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} ({a.role})
            </option>
          ))}
        </select>
        {selectedAgent && colors && (
          <span className={`font-mono text-xs px-2 py-1 rounded border ${colors.badge}`}>
            LV{selectedAgent.level}
          </span>
        )}
        {presets.length > 0 && (
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="font-mono text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors"
          >
            ⚡ PRESET
          </button>
        )}
        {/* 세션 상태 배지 + 초기화 */}
        {selectedAgentId && (
          <div className="flex items-center gap-1">
            {hasHistory ? (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-500/80 bg-emerald-500/5">
                세션 유지 중
              </span>
            ) : (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-600 text-slate-600">
                새 대화
              </span>
            )}
            {hasHistory && !isBusy && (
              <button
                onClick={() => selectedAgentId && resetSession(selectedAgentId)}
                title="대화 이력 초기화 (새 세션 시작)"
                className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                ↺
              </button>
            )}
            {/* 권한 설정 버튼 */}
            <button
              onClick={() => setPermissionModalAgentId(selectedAgentId)}
              title="에이전트 권한 설정"
              className={[
                'font-mono text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                agentPermissions[selectedAgentId]
                  ? 'border-amber-500/50 text-amber-400/80 bg-amber-500/5 hover:bg-amber-500/10'
                  : 'border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-500/40',
              ].join(' ')}
            >
              🔑
            </button>
          </div>
        )}
      </div>

      {/* 프리셋 드롭다운 */}
      {showPresets && presets.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-1">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); setShowPresets(false) }}
              className="text-left font-mono text-xs text-slate-300 hover:text-slate-100 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
            >
              › {p}
            </button>
          ))}
        </div>
      )}

      {/* Output area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 font-mono text-sm min-h-0">
        {consoleHistory.length === 0 && !stream?.chunks && !isWaiting && (
          <div className="text-slate-600 text-center pt-8">
            <div className="text-2xl mb-2">{'>'}_</div>
            <div>에이전트를 선택하고 명령을 입력하세요</div>
            <div className="text-xs mt-2">⚡ PRESET 버튼으로 빠른 명령을 사용할 수 있습니다</div>
          </div>
        )}

        {/* Historical entries */}
        {[...consoleHistory].reverse().map((entry, i) => {
          const agent = agents.find((a) => a.id === entry.agentId)
          const c = agent ? TEAM_COLORS[agent.team] : null
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className={`shrink-0 text-xs ${c?.text ?? 'text-slate-400'}`}>
                  [{agent?.displayName ?? entry.agentId}]
                </span>
                <span className="text-slate-300 text-xs">&gt; {entry.command}</span>
                <span className="ml-auto text-slate-600 text-[10px] shrink-0">
                  {new Date(entry.ts).toLocaleTimeString('ko-KR', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
              </div>
              {entry.response && (
                <div className="pl-4 text-slate-400 whitespace-pre-wrap border-l-2 border-slate-700 text-xs leading-relaxed">
                  {entry.response}
                </div>
              )}
            </div>
          )
        })}

        {/* 대기 중 진행 표시 (첫 청크 도착 전) */}
        {isWaiting && selectedAgent && (
          <div className="pl-4 border-l-2 border-emerald-500/30">
            <WaitingIndicator
              agentName={selectedAgent.displayName}
              color={colors?.text ?? 'text-slate-400'}
            />
          </div>
        )}

        {/* Live streaming */}
        {stream?.chunks && selectedAgent && (
          <div className="space-y-2">
            <div className={`font-mono text-xs ${colors?.text ?? 'text-slate-400'}`}>
              [{selectedAgent.displayName}]{isStreaming ? ' 응답 중...' : ' 완료'}
            </div>
            <div className="pl-4 text-slate-300 whitespace-pre-wrap border-l-2 border-emerald-500/50 text-xs leading-relaxed">
              {stream.chunks}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-blink" />
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className={`absolute left-3 top-2.5 font-mono text-sm ${colors?.text ?? 'text-slate-500'}`}>
              &gt;
            </span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                wsStatus !== 'connected'
                  ? '서버 연결 대기 중...'
                  : isBusy
                  ? '응답 대기 중... (■ STOP으로 중단)'
                  : selectedAgent
                  ? `${selectedAgent.displayName}에게 명령 입력... (Ctrl+Enter 실행)`
                  : '에이전트를 먼저 선택하세요'
              }
              disabled={!selectedAgentId || isBusy || wsStatus !== 'connected'}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none disabled:opacity-50"
            />
          </div>

          {isBusy ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 rounded font-mono text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all"
            >
              ■ STOP
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={!selectedAgentId || !input.trim() || wsStatus !== 'connected'}
              className={[
                'px-4 py-2 rounded font-mono text-sm font-bold transition-all',
                'disabled:opacity-30 disabled:cursor-not-allowed',
                colors
                  ? `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-90`
                  : 'bg-slate-700 text-slate-300',
              ].join(' ')}
            >
              EXECUTE
            </button>
          )}
        </div>
        <div className="mt-1 font-mono text-[10px] text-slate-600">
          Ctrl+Enter 실행 · ■ STOP으로 중단 가능
        </div>
      </div>
    </div>
  )
}
