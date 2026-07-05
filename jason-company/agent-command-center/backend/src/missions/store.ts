import { randomUUID } from 'crypto'

export type MissionStatus = 'backlog' | 'in-progress' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high'

export interface Mission {
  id: string
  title: string
  description: string
  agentIds: string[]
  status: MissionStatus
  priority: Priority
  createdAt: string
  updatedAt: string
  result?: string
}

class MissionStore {
  private missions: Map<string, Mission> = new Map()

  create(data: Pick<Mission, 'title' | 'description' | 'agentIds' | 'priority'>): Mission {
    const mission: Mission = {
      id: randomUUID(),
      ...data,
      status: 'backlog',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.missions.set(mission.id, mission)
    return mission
  }

  get(id: string): Mission | undefined {
    return this.missions.get(id)
  }

  getAll(): Mission[] {
    return Array.from(this.missions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  updateStatus(id: string, status: MissionStatus, result?: string): Mission | undefined {
    const mission = this.missions.get(id)
    if (!mission) return undefined
    mission.status = status
    mission.updatedAt = new Date().toISOString()
    if (result !== undefined) mission.result = result
    return mission
  }

  delete(id: string): boolean {
    return this.missions.delete(id)
  }
}

export const missionStore = new MissionStore()
