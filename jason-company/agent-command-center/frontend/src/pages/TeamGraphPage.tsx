import { useStore } from '../store/useStore'
import { TeamGraph } from '../components/TeamGraph'
import type { Relation } from '../types'
import { useEffect, useState } from 'react'

export function TeamGraphPage() {
  const { agents, setActiveAgent } = useStore()
  const [relations, setRelations] = useState<Relation[]>([])

  useEffect(() => {
    fetch('/api/agents/relations')
      .then((r) => r.json())
      .then(setRelations)
      .catch(console.error)
  }, [])

  return (
    <div className="h-full flex flex-col gap-3">
      <h2 className="font-mono text-slate-300 font-bold tracking-widest shrink-0">TEAM SYNERGY GRAPH</h2>
      <div className="flex-1 min-h-0">
        <TeamGraph
          agents={agents}
          relations={relations}
          onSelectAgent={(id) => {
            setActiveAgent(id)
            window.location.hash = '/'
          }}
        />
      </div>
    </div>
  )
}
