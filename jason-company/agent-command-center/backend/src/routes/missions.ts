import { Router } from 'express'
import { missionStore, type MissionStatus, type Priority } from '../missions/store'

export const missionsRouter = Router()

missionsRouter.get('/', (_req, res) => {
  res.json(missionStore.getAll())
})

missionsRouter.post('/', (req, res) => {
  const { title, description, agentIds, priority } = req.body as {
    title: string
    description: string
    agentIds: string[]
    priority: Priority
  }

  if (!title || !agentIds?.length) {
    return res.status(400).json({ error: 'title and agentIds are required' })
  }

  const mission = missionStore.create({ title, description: description || '', agentIds, priority: priority || 'medium' })
  return res.status(201).json(mission)
})

missionsRouter.patch('/:id/status', (req, res) => {
  const { status } = req.body as { status: MissionStatus }
  const mission = missionStore.updateStatus(req.params.id, status)
  if (!mission) return res.status(404).json({ error: 'Mission not found' })
  return res.json(mission)
})

missionsRouter.delete('/:id', (req, res) => {
  const ok = missionStore.delete(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Mission not found' })
  return res.json({ ok: true })
})
