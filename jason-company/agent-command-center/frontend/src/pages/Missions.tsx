import { useStore } from '../store/useStore'
import { MissionBoard } from '../components/MissionBoard'

export function Missions() {
  const { agents } = useStore()
  return <MissionBoard agents={agents} />
}
