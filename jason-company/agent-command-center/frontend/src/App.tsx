import { useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { useWebSocket } from './hooks/useWebSocket'
import { Dashboard } from './pages/Dashboard'
import { Missions } from './pages/Missions'
import { TeamGraphPage } from './pages/TeamGraphPage'
import { PermissionModal } from './components/PermissionModal'
import type { Agent, Mission } from './types'

const NAV_ITEMS = [
  { to: '/', label: '◈ COMMAND CENTER', exact: true },
  { to: '/missions', label: '⊞ MISSIONS', exact: false },
  { to: '/graph', label: '◉ TEAM GRAPH', exact: false },
]

export default function App() {
  const { setAgents, setMissions, agents, agentPermissions, permissionModalAgentId, setPermissionModalAgentId } = useStore()
  useWebSocket()

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then((r) => r.json() as Promise<Agent[]>),
      fetch('/api/missions').then((r) => r.json() as Promise<Mission[]>),
    ])
      .then(([agents, missions]) => {
        setAgents(agents)
        setMissions(missions)
      })
      .catch(console.error)
  }, [setAgents, setMissions])

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-mono overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-full px-6 py-3 flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-amber-400 font-bold tracking-widest text-sm">JASON COMPANY</span>
            <span className="text-slate-600 text-xs">COMMAND CENTER v1.0</span>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  [
                    'px-3 py-1.5 rounded text-xs tracking-wider transition-colors',
                    isActive
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/graph" element={<TeamGraphPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Permission modal */}
      {permissionModalAgentId && (() => {
        const agent = agents.find((a) => a.id === permissionModalAgentId)
        if (!agent) return null
        const current = agentPermissions[permissionModalAgentId] ?? { mode: 'default' as const, allowedTools: [] }
        return (
          <PermissionModal
            agent={agent}
            currentPermissions={current}
            onClose={() => setPermissionModalAgentId(null)}
          />
        )
      })()}
    </div>
  )
}
