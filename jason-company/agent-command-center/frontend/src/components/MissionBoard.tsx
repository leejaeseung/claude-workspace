import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { MissionCard } from './MissionCard'
import type { Agent, Mission, Priority } from '../types'

interface Props {
  agents: Agent[]
}

const COLUMNS: { key: Mission['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'BACKLOG', color: 'border-slate-600' },
  { key: 'in-progress', label: 'IN PROGRESS', color: 'border-blue-500' },
  { key: 'review', label: 'REVIEW', color: 'border-yellow-500' },
  { key: 'done', label: 'DONE', color: 'border-emerald-500' },
]

export function MissionBoard({ agents }: Props) {
  const { missions, addMission, updateMission, removeMission } = useStore()
  const { sendCommand } = useWebSocket()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    agentIds: [] as string[],
    priority: 'medium' as Priority,
  })

  const handleCreate = async () => {
    if (!form.title.trim() || !form.agentIds.length) return
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const mission: Mission = await res.json()
    addMission(mission)
    setForm({ title: '', description: '', agentIds: [], priority: 'medium' })
    setShowForm(false)
  }

  const handleStatusChange = async (id: string, status: Mission['status']) => {
    const res = await fetch(`/api/missions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const mission: Mission = await res.json()
    updateMission(mission)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/missions/${id}`, { method: 'DELETE' })
    removeMission(id)
  }

  const handleExecute = (mission: Mission) => {
    if (!mission.agentIds.length) return
    const agentId = mission.agentIds[0]
    const command = mission.description || mission.title
    useStore.getState().addConsoleEntry(agentId, command)
    useStore.getState().clearStream(agentId)
    sendCommand(agentId, command, mission.id)
  }

  const toggleAgent = (id: string) => {
    setForm((f) => ({
      ...f,
      agentIds: f.agentIds.includes(id) ? f.agentIds.filter((a) => a !== id) : [...f.agentIds, id],
    }))
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Create button */}
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-slate-300 font-bold tracking-widest">MISSION BOARD</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono text-xs px-3 py-1.5 rounded border border-emerald-500/50 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
        >
          + NEW MISSION
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="미션 제목 *"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-400"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="상세 설명 (에이전트에게 전달될 명령)"
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-400 resize-none"
          />
          <div className="space-y-1">
            <div className="font-mono text-xs text-slate-500">담당 에이전트 선택:</div>
            <div className="flex flex-wrap gap-1.5">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAgent(a.id)}
                  className={[
                    'font-mono text-xs px-2 py-1 rounded border transition-colors',
                    form.agentIds.includes(a.id)
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500',
                  ].join(' ')}
                >
                  {a.displayName}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-sm text-slate-100 focus:outline-none"
            >
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.agentIds.length}
              className="px-4 py-1 rounded font-mono text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              CREATE
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="font-mono text-xs text-slate-500 hover:text-slate-300"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 grid grid-cols-4 gap-3 min-h-0 overflow-hidden">
        {COLUMNS.map((col) => {
          const colMissions = missions.filter((m) => m.status === col.key)
          return (
            <div key={col.key} className="flex flex-col min-h-0">
              <div className={`font-mono text-xs font-bold tracking-widest mb-2 pb-2 border-b-2 ${col.color}`}>
                <span className="text-slate-400">{col.label}</span>
                <span className="ml-2 text-slate-600">({colMissions.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {colMissions.map((m) => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    agents={agents}
                    onExecute={handleExecute}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {colMissions.length === 0 && (
                  <div className="font-mono text-xs text-slate-700 text-center pt-4">— EMPTY —</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
