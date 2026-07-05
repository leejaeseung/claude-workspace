import { useStore } from '../store/useStore'
import { AgentCard } from '../components/AgentCard'
import { CommandConsole } from '../components/CommandConsole'
import { TEAM_LABELS } from '../types'
import type { Team } from '../types'

const TEAM_ORDER: Team[] = ['supervisor', 'code-quality', 'feature-develop', 'hr']

export function Dashboard() {
  const { agents, streams, activeAgentId, setActiveAgent } = useStore()

  const grouped = TEAM_ORDER.reduce<Record<string, typeof agents>>((acc, team) => {
    acc[team] = agents.filter((a) => a.team === team)
    return acc
  }, {})

  return (
    <div className="flex h-full gap-4">
      {/* Left: Agent cards */}
      <div className="w-96 shrink-0 overflow-y-auto pr-1 space-y-5">
        {TEAM_ORDER.map((team) => {
          const teamAgents = grouped[team]
          if (!teamAgents?.length) return null
          return (
            <div key={team}>
              <div className="font-mono text-[10px] text-slate-500 tracking-widest mb-2 uppercase">
                ── {TEAM_LABELS[team]} ──────────────────
              </div>
              <div className="grid grid-cols-2 gap-2">
                {teamAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selected={activeAgentId === agent.id}
                    onClick={() => setActiveAgent(activeAgentId === agent.id ? null : agent.id)}
                    isStreaming={streams[agent.id]?.isStreaming}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: Command console */}
      <div className="flex-1 min-w-0">
        <CommandConsole
          agents={agents}
          selectedAgentId={activeAgentId}
          onSelectAgent={setActiveAgent}
        />
      </div>
    </div>
  )
}
