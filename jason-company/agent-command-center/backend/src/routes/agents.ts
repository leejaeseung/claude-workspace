import { Router } from 'express'
import { loadAgents, relations } from '../agents/loader'

export const agentsRouter = Router()

agentsRouter.get('/', (_req, res) => {
  const agents = loadAgents().map(({ systemPrompt: _sp, ...rest }) => rest)
  res.json(agents)
})

agentsRouter.get('/relations', (_req, res) => {
  res.json(relations)
})
