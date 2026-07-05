import type { Agent } from '../types'
import { TEAM_COLORS, TEAM_LABELS } from '../types'

interface Props {
  agent: Agent
  selected: boolean
  onClick: () => void
  isStreaming?: boolean
}

const STATUS_STYLE = {
  idle: 'bg-slate-700 text-slate-300',
  'on-mission': 'bg-emerald-500/20 text-emerald-300 animate-pulse',
}

export function AgentCard({ agent, selected, onClick, isStreaming }: Props) {
  const colors = TEAM_COLORS[agent.team]

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full text-left rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer',
        'bg-slate-900 hover:bg-slate-800',
        colors.border,
        selected ? `shadow-lg ${colors.glow} scale-[1.02]` : 'opacity-80 hover:opacity-100',
        isStreaming ? 'ring-2 ring-emerald-500/60 animate-pulse-slow' : '',
      ].join(' ')}
    >
      {/* Level badge */}
      <div className={`absolute top-2 right-2 font-mono text-xs font-bold ${colors.text}`}>
        LV{agent.level}
      </div>

      {/* Avatar */}
      <div
        className={[
          'w-12 h-12 rounded-lg flex items-center justify-center',
          'font-mono font-bold text-lg mb-3',
          colors.bg,
          colors.text,
        ].join(' ')}
      >
        {agent.avatar}
      </div>

      {/* Name */}
      <div className="font-mono font-bold text-slate-100 text-sm truncate">
        {agent.displayName}
      </div>

      {/* Role */}
      <div className={`font-mono text-xs mt-0.5 truncate ${colors.text}`}>{agent.role}</div>

      {/* Team badge */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors.badge}`}>
          {TEAM_LABELS[agent.team]}
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${STATUS_STYLE[agent.status]}`}>
          {isStreaming ? 'ACTIVE' : agent.status === 'idle' ? 'IDLE' : 'ON MISSION'}
        </span>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.border.replace('border', 'bg')}`} />
      )}
    </button>
  )
}
