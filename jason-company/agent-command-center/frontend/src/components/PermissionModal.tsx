import { useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { TEAM_COLORS, PERMISSION_MODE_LABELS } from '../types'
import type { Agent, AgentPermissions, PermissionPreset, ToolGroup, PermissionMode } from '../types'

interface Props {
  agent: Agent
  currentPermissions: AgentPermissions
  onClose: () => void
}

const MODE_RISK: Record<PermissionMode, { color: string; label: string }> = {
  default:            { color: 'text-slate-400',  label: '안전' },
  acceptEdits:        { color: 'text-blue-400',   label: '보통' },
  dontAsk:            { color: 'text-yellow-400', label: '주의' },
  bypassPermissions:  { color: 'text-red-400',    label: '위험' },
}

export function PermissionModal({ agent, currentPermissions, onClose }: Props) {
  const { setPermissions } = useWebSocket()
  const colors = TEAM_COLORS[agent.team]

  const [presets, setPresets] = useState<PermissionPreset[]>([])
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([])
  const [draft, setDraft] = useState<AgentPermissions>(currentPermissions)

  useEffect(() => {
    Promise.all([
      fetch('/api/permission-presets').then((r) => r.json()),
      fetch('/api/tool-groups').then((r) => r.json()),
    ]).then(([p, t]) => { setPresets(p); setToolGroups(t) })
  }, [])

  const applyPreset = (preset: PermissionPreset) => {
    setDraft(preset.permissions)
  }

  const toggleToolGroup = (group: ToolGroup) => {
    const allIncluded = group.tools.every((t) => draft.allowedTools.includes(t))
    if (allIncluded) {
      setDraft((d) => ({ ...d, allowedTools: d.allowedTools.filter((t) => !group.tools.includes(t)) }))
    } else {
      setDraft((d) => ({
        ...d,
        allowedTools: Array.from(new Set([...d.allowedTools, ...group.tools])),
      }))
    }
  }

  const handleSave = () => {
    setPermissions(agent.id, draft)
    onClose()
  }

  const activePreset = presets.find(
    (p) =>
      p.permissions.mode === draft.mode &&
      JSON.stringify([...p.permissions.allowedTools].sort()) ===
        JSON.stringify([...draft.allowedTools].sort())
  )

  const risk = MODE_RISK[draft.mode]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-[480px] bg-slate-900 border-2 ${colors.border} rounded-xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 ${colors.bg} border-b border-slate-700 flex items-center justify-between`}>
          <div>
            <div className={`font-mono text-sm font-bold ${colors.text}`}>{agent.displayName}</div>
            <div className="font-mono text-xs text-slate-400">에이전트 권한 설정</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 프리셋 */}
          <div>
            <div className="font-mono text-xs text-slate-500 mb-2 tracking-widest">─ PRESETS</div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={[
                    'text-left p-3 rounded-lg border transition-all',
                    activePreset?.id === preset.id
                      ? `${colors.border} ${colors.bg} ${colors.text}`
                      : 'border-slate-700 hover:border-slate-500 text-slate-300',
                  ].join(' ')}
                >
                  <div className="font-mono text-sm font-bold">
                    {preset.icon} {preset.label}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 권한 모드 */}
          <div>
            <div className="font-mono text-xs text-slate-500 mb-2 tracking-widest">─ PERMISSION MODE</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PERMISSION_MODE_LABELS) as PermissionMode[]).map((mode) => {
                const r = MODE_RISK[mode]
                return (
                  <button
                    key={mode}
                    onClick={() => setDraft((d) => ({ ...d, mode }))}
                    className={[
                      'text-left px-3 py-2 rounded-lg border font-mono text-xs transition-all',
                      draft.mode === mode
                        ? `border-slate-400 bg-slate-800 text-slate-100`
                        : 'border-slate-700 text-slate-400 hover:border-slate-500',
                    ].join(' ')}
                  >
                    <span className={r.color}>[{r.label}]</span>{' '}
                    {PERMISSION_MODE_LABELS[mode]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 도구 그룹 */}
          <div>
            <div className="font-mono text-xs text-slate-500 mb-2 tracking-widest">─ TOOL PERMISSIONS</div>
            <div className="space-y-2">
              {toolGroups.map((group) => {
                const allOn = group.tools.every((t) => draft.allowedTools.includes(t))
                const someOn = group.tools.some((t) => draft.allowedTools.includes(t))
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleToolGroup(group)}
                    className={[
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all',
                      allOn
                        ? `${colors.border} ${colors.bg}`
                        : someOn
                        ? 'border-slate-600 bg-slate-800/50'
                        : 'border-slate-700 hover:border-slate-600',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <div className={[
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors text-[10px]',
                        allOn ? `${colors.border} ${colors.bg} ${colors.text}` : 'border-slate-600',
                      ].join(' ')}>
                        {allOn ? '✓' : someOn ? '–' : ''}
                      </div>
                      <span className={`font-mono text-sm ${allOn ? 'text-slate-100' : 'text-slate-400'}`}>
                        {group.label}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {group.tools.map((t) => (
                        <span
                          key={t}
                          className={`font-mono text-[9px] px-1 py-0.5 rounded ${
                            draft.allowedTools.includes(t)
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800 text-slate-600'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
            {draft.allowedTools.length === 0 && draft.mode !== 'bypassPermissions' && (
              <div className="mt-2 font-mono text-[10px] text-slate-600">
                ※ 도구를 선택하지 않으면 기본 도구 세트가 사용됩니다
              </div>
            )}
          </div>

          {/* 현재 설정 요약 */}
          <div className={`p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
            <div className="font-mono text-xs text-slate-400 mb-1">현재 설정</div>
            <div className={`font-mono text-xs ${risk.color}`}>
              모드: {PERMISSION_MODE_LABELS[draft.mode]} ({risk.label})
            </div>
            {draft.allowedTools.length > 0 ? (
              <div className="font-mono text-xs text-slate-400 mt-0.5">
                허용 도구: {draft.allowedTools.join(', ')}
              </div>
            ) : (
              <div className="font-mono text-xs text-slate-500 mt-0.5">
                {draft.mode === 'bypassPermissions' ? '모든 도구 허용' : '기본 도구 세트'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="font-mono text-xs px-4 py-2 rounded border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className={`font-mono text-xs px-4 py-2 rounded border ${colors.border} ${colors.bg} ${colors.text} hover:opacity-90 transition-all`}
          >
            권한 적용
          </button>
        </div>
      </div>
    </div>
  )
}
