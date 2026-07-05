export type PermissionMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions'

export interface AgentPermissions {
  mode: PermissionMode
  allowedTools: string[]  // 빈 배열 = 제한 없음
}

export interface PermissionPreset {
  id: string
  label: string
  description: string
  icon: string
  permissions: AgentPermissions
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'readonly',
    label: '읽기 전용',
    description: '파일 읽기, 웹 검색만 허용',
    icon: '🔍',
    permissions: {
      mode: 'default',
      allowedTools: ['Read', 'WebSearch', 'WebFetch', 'ToolSearch'],
    },
  },
  {
    id: 'editor',
    label: '편집자',
    description: '파일 읽기/쓰기 허용, 실행 불가',
    icon: '✏️',
    permissions: {
      mode: 'acceptEdits',
      allowedTools: ['Read', 'Edit', 'Write', 'WebSearch', 'WebFetch'],
    },
  },
  {
    id: 'developer',
    label: '개발자',
    description: '파일 조작 + Bash 실행 허용',
    icon: '💻',
    permissions: {
      mode: 'acceptEdits',
      allowedTools: ['Read', 'Edit', 'Write', 'Bash', 'WebSearch', 'WebFetch', 'ToolSearch'],
    },
  },
  {
    id: 'full',
    label: '전체 권한',
    description: '모든 도구, 권한 확인 없음',
    icon: '🔓',
    permissions: {
      mode: 'bypassPermissions',
      allowedTools: [],
    },
  },
  {
    id: 'none',
    label: '권한 없음',
    description: '기본 모드 (매번 권한 확인)',
    icon: '🔒',
    permissions: {
      mode: 'default',
      allowedTools: [],
    },
  },
]

export const TOOL_GROUPS = [
  {
    id: 'file-read',
    label: '파일 읽기',
    tools: ['Read'],
  },
  {
    id: 'file-write',
    label: '파일 쓰기',
    tools: ['Edit', 'Write'],
  },
  {
    id: 'bash',
    label: 'Bash 실행',
    tools: ['Bash'],
  },
  {
    id: 'web',
    label: '웹 접근',
    tools: ['WebSearch', 'WebFetch'],
  },
  {
    id: 'task',
    label: '태스크 관리',
    tools: ['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop', 'TaskOutput'],
  },
]

export const DEFAULT_PERMISSIONS: AgentPermissions = {
  mode: 'default',
  allowedTools: [],
}

// 클라이언트별 에이전트 권한 저장소 (in-memory)
export class PermissionStore {
  private store = new Map<string, AgentPermissions>() // key: agentId

  get(agentId: string): AgentPermissions {
    return this.store.get(agentId) ?? DEFAULT_PERMISSIONS
  }

  set(agentId: string, perms: AgentPermissions) {
    this.store.set(agentId, perms)
  }

  delete(agentId: string) {
    this.store.delete(agentId)
  }

  getAll(): Record<string, AgentPermissions> {
    return Object.fromEntries(this.store.entries())
  }
}
