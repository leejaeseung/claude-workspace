import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'

const WS_URL = 'ws://localhost:3001'
const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 30_000
const PING_INTERVAL_MS = 25_000

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempt = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const unmounted = useRef(false)

  const {
    appendStreamChunk,
    finishStream,
    updateMission,
    finalizeConsoleEntry,
    setWsStatus,
    setWaiting,
    setAgentPermissions,
  } = useStore()

  const clearTimers = () => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    if (pingTimer.current) clearInterval(pingTimer.current)
  }

  const connect = useCallback(() => {
    if (unmounted.current) return
    setWsStatus('connecting')
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      reconnectAttempt.current = 0
      setWsStatus('connected')
      pingTimer.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL_MS)
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string
          content?: string
          agentId?: string
          error?: string
          mission?: Parameters<typeof updateMission>[0]
        }

        if (msg.type === 'pong' || msg.type === 'session_reset') return

        if (msg.type === 'permissions_updated' || msg.type === 'permissions_data') {
          const m = msg as { agentId?: string; permissions?: Parameters<typeof setAgentPermissions>[1] }
          if (m.agentId && m.permissions) setAgentPermissions(m.agentId, m.permissions)
          return
        }

        if (msg.type === 'stream_chunk' && msg.agentId && msg.content) {
          appendStreamChunk(msg.agentId, msg.content)
        } else if (msg.type === 'stream_end' && msg.agentId) {
          const state = useStore.getState()
          const response = state.streams[msg.agentId]?.chunks ?? ''
          finalizeConsoleEntry(msg.agentId, response)
          finishStream(msg.agentId)
        } else if (msg.type === 'stream_error' && msg.agentId) {
          const isAbort = msg.error === '명령이 중단되었습니다.'
          if (!isAbort) {
            finalizeConsoleEntry(msg.agentId, `[ERROR] ${msg.error}`)
          }
          setWaiting(msg.agentId, false)
          finishStream(msg.agentId)
        } else if (msg.type === 'mission_update' && msg.mission) {
          updateMission(msg.mission)
        }
      } catch {
        // ignore malformed messages
      }
    }

    socket.onclose = () => {
      clearTimers()
      setWsStatus('disconnected')

      // 연결 끊김 → 스트리밍 중인 세션 모두 정리
      const state = useStore.getState()
      Object.entries(state.streams).forEach(([agentId, s]) => {
        if (s.isStreaming) {
          state.finalizeConsoleEntry(agentId, state.streams[agentId]?.chunks ?? '')
          finishStream(agentId)
        }
        if (state.waiting[agentId]) {
          setWaiting(agentId, false)
        }
      })

      if (!unmounted.current) {
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** reconnectAttempt.current,
          RECONNECT_MAX_MS
        )
        reconnectAttempt.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    socket.onerror = () => { socket.close() }
  }, [appendStreamChunk, finishStream, updateMission, finalizeConsoleEntry, setWsStatus, setWaiting])

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      clearTimers()
      ws.current?.close()
    }
  }, [connect])

  const sendCommand = useCallback((agentId: string, command: string, missionId?: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      setWaiting(agentId, true)
      ws.current.send(JSON.stringify({ type: 'command', agentId, command, missionId }))
      return true
    }
    return false
  }, [setWaiting])

  const abortCommand = useCallback((agentId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'abort', agentId }))
    }
    const state = useStore.getState()
    if (state.streams[agentId]?.isStreaming || state.waiting[agentId]) {
      const partial = state.streams[agentId]?.chunks ?? ''
      state.finalizeConsoleEntry(agentId, partial ? partial + '\n\n[중단됨]' : '[중단됨]')
      finishStream(agentId)
      setWaiting(agentId, false)
    }
  }, [finishStream, setWaiting])

  // 에이전트 대화 세션 초기화 (새 대화 시작)
  const resetSession = useCallback((agentId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'reset_session', agentId }))
    }
    // 로컬 히스토리도 초기화
    useStore.setState((state) => ({
      consoleHistory: state.consoleHistory.filter((h) => h.agentId !== agentId),
      streams: { ...state.streams, [agentId]: { chunks: '', isStreaming: false } },
    }))
  }, [])

  const setPermissions = useCallback((agentId: string, permissions: Parameters<typeof setAgentPermissions>[1]) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'set_permissions', agentId, permissions }))
    }
    setAgentPermissions(agentId, permissions)
  }, [setAgentPermissions])

  return { sendCommand, abortCommand, resetSession, setPermissions }
}
