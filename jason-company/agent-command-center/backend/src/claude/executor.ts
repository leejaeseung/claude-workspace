import { spawn, type ChildProcess } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { WebSocket } from 'ws'
import type { AgentPermissions } from '../agents/permissions'

const SYSTEM_SUFFIX = `

---
당신은 위에 정의된 에이전트입니다. 항상 해당 에이전트의 철학, 말투, 업무 원칙, 팀 문화를 완벽히 유지하며 응답하세요.
응답은 반드시 한국어로 작성하되, 코드나 기술 용어는 원래 표기를 사용합니다.
에이전트의 성격과 전문성을 살려 자연스럽게 대화하세요.`

export interface ExecutorResult {
  response: string
  sessionId: string | null
}

export interface ExecutorHandle {
  result: Promise<ExecutorResult>
  abort: () => void
}

export function executeAgentCommand(
  systemPrompt: string,
  command: string,
  ws: WebSocket,
  agentId: string,
  resumeSessionId?: string,
  permissions?: AgentPermissions
): ExecutorHandle {
  let proc: ChildProcess | null = null
  let aborted = false

  const result = (async (): Promise<ExecutorResult> => {
    // --resume 모드: 이전 세션 이어받기 (시스템 프롬프트 불필요)
    // 신규 세션: 에이전트 시스템 프롬프트 파일 생성
    let systemFile: string | null = null
    if (!resumeSessionId) {
      systemFile = join(tmpdir(), `agent-${agentId}-${Date.now()}.txt`)
      await writeFile(systemFile, systemPrompt + SYSTEM_SUFFIX, 'utf-8')
    }

    return new Promise<ExecutorResult>((resolve) => {
      if (aborted) {
        if (systemFile) unlink(systemFile).catch(() => {})
        ws.send(JSON.stringify({ type: 'stream_end', agentId }))
        resolve({ response: '', sessionId: resumeSessionId ?? null })
        return
      }

      let fullResponse = ''
      let capturedSessionId: string | null = resumeSessionId ?? null
      let buffer = ''

      // 권한 플래그 구성
      const permArgs: string[] = []
      if (permissions) {
        if (permissions.mode !== 'default') {
          permArgs.push('--permission-mode', permissions.mode)
        }
        if (permissions.allowedTools.length > 0) {
          permArgs.push('--allowedTools', permissions.allowedTools.join(','))
        }
      }

      const args = resumeSessionId
        ? ['-p', command, '--resume', resumeSessionId, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', ...permArgs]
        : ['-p', command, '--system-prompt-file', systemFile!, '--output-format', 'stream-json', '--verbose', '--include-partial-messages', ...permArgs]

      proc = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      proc.stdout!.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as Record<string, unknown>

            // 신규 세션: session_id 캡처
            if (event.type === 'system' && event.subtype === 'init' && !capturedSessionId) {
              capturedSessionId = (event.session_id as string) ?? null
            }

            // 텍스트 스트리밍
            const streamEvent = event.event as Record<string, unknown> | undefined
            if (event.type === 'stream_event' && streamEvent?.type === 'content_block_delta') {
              const delta = streamEvent.delta as Record<string, unknown> | undefined
              if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
                fullResponse += delta.text
                if (ws.readyState === ws.OPEN) {
                  ws.send(JSON.stringify({ type: 'stream_chunk', content: delta.text, agentId }))
                }
              }
            }

            // 최종 결과 fallback
            if (event.type === 'result' && event.subtype === 'success' && !fullResponse) {
              const res = event.result as string
              fullResponse = res
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'stream_chunk', content: res, agentId }))
              }
            }
          } catch {
            // JSON 파싱 실패 무시
          }
        }
      })

      proc.stderr!.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg && !msg.includes('no stdin')) console.error('[claude]', msg)
      })

      proc.on('close', async (code) => {
        proc = null
        if (systemFile) await unlink(systemFile).catch(() => {})
        if (ws.readyState === ws.OPEN) {
          if (aborted) {
            ws.send(JSON.stringify({ type: 'stream_error', error: '명령이 중단되었습니다.', agentId }))
          }
          ws.send(JSON.stringify({ type: 'stream_end', agentId, sessionId: capturedSessionId }))
        }
        if (code !== 0 && !aborted) {
          console.error(`[claude] exited with code ${code} (agent: ${agentId})`)
        }
        resolve({ response: fullResponse, sessionId: capturedSessionId })
      })

      proc.on('error', async (err) => {
        proc = null
        if (systemFile) await unlink(systemFile).catch(() => {})
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'stream_error', error: err.message, agentId }))
          ws.send(JSON.stringify({ type: 'stream_end', agentId, sessionId: capturedSessionId }))
        }
        resolve({ response: '', sessionId: capturedSessionId })
      })
    })
  })()

  const abort = () => {
    aborted = true
    if (proc) {
      proc.kill('SIGTERM')
      proc = null
    }
  }

  return { result, abort }
}
