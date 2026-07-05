import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import cors from 'cors'
import { agentsRouter } from './routes/agents'
import { missionsRouter } from './routes/missions'
import { loadAgentById } from './agents/loader'
import { executeAgentCommand, type ExecutorHandle } from './claude/executor'
import { missionStore } from './missions/store'
import {
  PermissionStore,
  PERMISSION_PRESETS,
  TOOL_GROUPS,
  type AgentPermissions,
} from './agents/permissions'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/agents', agentsRouter)
app.use('/api/missions', missionsRouter)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/permission-presets', (_req, res) => res.json(PERMISSION_PRESETS))
app.get('/api/tool-groups', (_req, res) => res.json(TOOL_GROUPS))

const server = createServer(app)
const wss = new WebSocketServer({ server })

interface ClientState {
  executors: Map<string, ExecutorHandle>
  sessions: Map<string, string>       // agentId → claude session_id
  permissions: PermissionStore        // agentId → permissions
}

const clientStates = new Map<WebSocket, ClientState>()

function broadcast(data: unknown) {
  const msg = JSON.stringify(data)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  })
}

const HEARTBEAT_INTERVAL = 30_000
const clientAlive = new WeakMap<WebSocket, boolean>()

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (clientAlive.get(ws) === false) {
      ws.terminate()
      return
    }
    clientAlive.set(ws, false)
    ws.ping()
  })
}, HEARTBEAT_INTERVAL)

wss.on('close', () => clearInterval(heartbeatTimer))

wss.on('connection', (ws) => {
  clientAlive.set(ws, true)
  clientStates.set(ws, {
    executors: new Map(),
    sessions: new Map(),
    permissions: new PermissionStore(),
  })

  ws.on('pong', () => clientAlive.set(ws, true))

  ws.on('message', async (raw) => {
    let msg: {
      type: string
      agentId?: string
      command?: string
      missionId?: string
      permissions?: AgentPermissions
    }
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    const state = clientStates.get(ws)
    if (!state) return

    // 중단
    if (msg.type === 'abort' && msg.agentId) {
      state.executors.get(msg.agentId)?.abort()
      state.executors.delete(msg.agentId)
      return
    }

    // 세션 초기화
    if (msg.type === 'reset_session' && msg.agentId) {
      state.sessions.delete(msg.agentId)
      ws.send(JSON.stringify({ type: 'session_reset', agentId: msg.agentId }))
      return
    }

    // 권한 설정
    if (msg.type === 'set_permissions' && msg.agentId && msg.permissions) {
      state.permissions.set(msg.agentId, msg.permissions)
      ws.send(JSON.stringify({
        type: 'permissions_updated',
        agentId: msg.agentId,
        permissions: msg.permissions,
      }))
      return
    }

    // 권한 조회
    if (msg.type === 'get_permissions' && msg.agentId) {
      ws.send(JSON.stringify({
        type: 'permissions_data',
        agentId: msg.agentId,
        permissions: state.permissions.get(msg.agentId),
      }))
      return
    }

    if (msg.type !== 'command' || !msg.agentId || !msg.command) return

    // 이미 실행 중이면 중단
    state.executors.get(msg.agentId)?.abort()

    const agent = loadAgentById(msg.agentId)
    if (!agent) {
      ws.send(JSON.stringify({ type: 'stream_error', error: `Agent ${msg.agentId} not found`, agentId: msg.agentId }))
      return
    }

    const existingSessionId = state.sessions.get(msg.agentId)
    const permissions = state.permissions.get(msg.agentId)

    if (msg.missionId) {
      const updated = missionStore.updateStatus(msg.missionId, 'in-progress')
      if (updated) broadcast({ type: 'mission_update', mission: updated })
    }

    const handle = executeAgentCommand(
      agent.systemPrompt,
      msg.command,
      ws,
      msg.agentId,
      existingSessionId,
      permissions
    )
    state.executors.set(msg.agentId, handle)

    const { response, sessionId } = await handle.result
    state.executors.delete(msg.agentId)

    if (sessionId) state.sessions.set(msg.agentId, sessionId)

    if (msg.missionId) {
      const updated = missionStore.updateStatus(msg.missionId, 'review', response)
      if (updated) broadcast({ type: 'mission_update', mission: updated })
    }
  })

  ws.on('close', () => {
    const state = clientStates.get(ws)
    state?.executors.forEach((handle) => handle.abort())
    clientStates.delete(ws)
    clientAlive.delete(ws)
  })

  ws.on('error', () => {
    const state = clientStates.get(ws)
    state?.executors.forEach((handle) => handle.abort())
    clientStates.delete(ws)
  })
})

const PORT = Number(process.env.PORT) || 3001
server.listen(PORT, () => {
  console.log(`[JASON COMPANY] Command Center backend: http://localhost:${PORT}`)
  console.log('[INFO] Claude CLI session persistence + permissions enabled')
})
