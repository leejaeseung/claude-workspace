import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { agentStaticData, relations, type Team } from './data'

export interface Agent {
  id: string
  displayName: string
  description: string
  team: Team
  level: number
  role: string
  avatar: string
  systemPrompt: string
  status: 'idle' | 'on-mission'
}

const AGENTS_PATH =
  process.env.AGENTS_PATH ||
  '/mnt/c/Users/wasd2/claude-workspace/jason-company/.claude/agents'

export function loadAgents(): Agent[] {
  if (!fs.existsSync(AGENTS_PATH)) {
    console.error(`Agents path not found: ${AGENTS_PATH}`)
    return []
  }

  const files = fs.readdirSync(AGENTS_PATH).filter((f) => f.endsWith('.md'))

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(AGENTS_PATH, file), 'utf-8')
    const parsed = matter(raw)
    const id = (parsed.data.name as string) || file.replace('.md', '')
    const staticData = agentStaticData[id] ?? {
      displayName: id,
      team: 'hr' as Team,
      level: 1,
      role: 'Agent',
      avatar: '?',
    }

    return {
      id,
      displayName: staticData.displayName,
      description: (parsed.data.description as string) ?? '',
      team: staticData.team,
      level: staticData.level,
      role: staticData.role,
      avatar: staticData.avatar,
      systemPrompt: parsed.content.trim(),
      status: 'idle' as const,
    }
  })
}

export function loadAgentById(id: string): Agent | undefined {
  return loadAgents().find((a) => a.id === id)
}

export { relations }
