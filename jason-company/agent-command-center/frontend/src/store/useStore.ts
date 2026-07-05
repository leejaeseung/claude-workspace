import { create } from 'zustand'
import type { Agent, Mission, StreamState, AgentPermissions } from '../types'

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

interface Store {
  agents: Agent[]
  missions: Mission[]
  streams: Record<string, StreamState>
  waiting: Record<string, boolean>
  agentPermissions: Record<string, AgentPermissions>
  activeAgentId: string | null
  permissionModalAgentId: string | null
  consoleHistory: { agentId: string; command: string; response: string; ts: string }[]
  wsStatus: WsStatus

  setAgents: (agents: Agent[]) => void
  setMissions: (missions: Mission[]) => void
  setActiveAgent: (id: string | null) => void
  setWsStatus: (status: WsStatus) => void
  setPermissionModalAgentId: (id: string | null) => void

  setAgentPermissions: (agentId: string, perms: AgentPermissions) => void
  setWaiting: (agentId: string, val: boolean) => void
  appendStreamChunk: (agentId: string, chunk: string) => void
  finishStream: (agentId: string) => void
  clearStream: (agentId: string) => void

  addConsoleEntry: (agentId: string, command: string) => void
  finalizeConsoleEntry: (agentId: string, response: string) => void

  updateMission: (mission: Mission) => void
  addMission: (mission: Mission) => void
  removeMission: (id: string) => void
}

export const useStore = create<Store>((set) => ({
  agents: [],
  missions: [],
  streams: {},
  waiting: {},
  agentPermissions: {},
  activeAgentId: null,
  permissionModalAgentId: null,
  consoleHistory: [],
  wsStatus: 'connecting',

  setAgents: (agents) => set({ agents }),
  setMissions: (missions) => set({ missions }),
  setActiveAgent: (id) => set({ activeAgentId: id }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setPermissionModalAgentId: (id) => set({ permissionModalAgentId: id }),

  setAgentPermissions: (agentId, perms) =>
    set((state) => ({
      agentPermissions: { ...state.agentPermissions, [agentId]: perms },
    })),

  setWaiting: (agentId, val) =>
    set((state) => ({ waiting: { ...state.waiting, [agentId]: val } })),

  appendStreamChunk: (agentId, chunk) =>
    set((state) => ({
      waiting: { ...state.waiting, [agentId]: false }, // 첫 청크 → waiting 해제
      streams: {
        ...state.streams,
        [agentId]: {
          chunks: (state.streams[agentId]?.chunks ?? '') + chunk,
          isStreaming: true,
        },
      },
    })),

  finishStream: (agentId) =>
    set((state) => ({
      waiting: { ...state.waiting, [agentId]: false },
      streams: {
        ...state.streams,
        [agentId]: {
          chunks: state.streams[agentId]?.chunks ?? '',
          isStreaming: false,
        },
      },
    })),

  clearStream: (agentId) =>
    set((state) => ({
      waiting: { ...state.waiting, [agentId]: false },
      streams: { ...state.streams, [agentId]: { chunks: '', isStreaming: false } },
    })),

  addConsoleEntry: (agentId, command) =>
    set((state) => ({
      consoleHistory: [
        { agentId, command, response: '', ts: new Date().toISOString() },
        ...state.consoleHistory,
      ].slice(0, 50),
    })),

  finalizeConsoleEntry: (agentId, response) =>
    set((state) => {
      const history = [...state.consoleHistory]
      const idx = history.findIndex((h) => h.agentId === agentId && h.response === '')
      if (idx !== -1) history[idx] = { ...history[idx], response }
      return { consoleHistory: history }
    }),

  updateMission: (mission) =>
    set((state) => ({
      missions: state.missions.map((m) => (m.id === mission.id ? mission : m)),
    })),

  addMission: (mission) =>
    set((state) => ({ missions: [mission, ...state.missions] })),

  removeMission: (id) =>
    set((state) => ({ missions: state.missions.filter((m) => m.id !== id) })),
}))

export function getStream(agentId: string): StreamState {
  return useStore.getState().streams[agentId] ?? { chunks: '', isStreaming: false }
}
