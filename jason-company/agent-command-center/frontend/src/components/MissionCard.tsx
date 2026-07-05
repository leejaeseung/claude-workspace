import type { Mission, Agent } from '../types'
import { PRIORITY_COLORS } from '../types'

interface Props {
  mission: Mission
  agents: Agent[]
  onExecute?: (mission: Mission) => void
  onStatusChange?: (id: string, status: Mission['status']) => void
  onDelete?: (id: string) => void
}

const STATUS_NEXT: Record<Mission['status'], Mission['status'] | null> = {
  backlog: 'in-progress',
  'in-progress': 'review',
  review: 'done',
  done: null,
}

export function MissionCard({ mission, agents, onExecute, onStatusChange, onDelete }: Props) {
  const assignedAgents = agents.filter((a) => mission.agentIds.includes(a.id))
  const nextStatus = STATUS_NEXT[mission.status]

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2 hover:border-slate-600 transition-colors">
      {/* Title + priority */}
      <div className="flex items-start gap-2">
        <div className="flex-1 font-mono text-sm text-slate-100 font-medium">{mission.title}</div>
        <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded ${PRIORITY_COLORS[mission.priority]}`}>
          {mission.priority.toUpperCase()}
        </span>
      </div>

      {/* Description */}
      {mission.description && (
        <div className="font-mono text-xs text-slate-500 line-clamp-2">{mission.description}</div>
      )}

      {/* Assigned agents */}
      <div className="flex flex-wrap gap-1">
        {assignedAgents.map((a) => (
          <span key={a.id} className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
            {a.displayName}
          </span>
        ))}
      </div>

      {/* Result preview */}
      {mission.result && (
        <div className="font-mono text-[10px] text-slate-500 bg-slate-800 rounded p-2 line-clamp-3 whitespace-pre-wrap">
          {mission.result}
        </div>
      )}

      {/* Date */}
      <div className="font-mono text-[10px] text-slate-600">
        {new Date(mission.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        {mission.status === 'backlog' && onExecute && (
          <button
            onClick={() => onExecute(mission)}
            className="flex-1 text-[11px] font-mono py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
          >
            ▶ EXECUTE
          </button>
        )}
        {nextStatus && onStatusChange && (
          <button
            onClick={() => onStatusChange(mission.id, nextStatus)}
            className="flex-1 text-[11px] font-mono py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            → {nextStatus.replace('-', ' ').toUpperCase()}
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(mission.id)}
            className="text-[11px] font-mono px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
