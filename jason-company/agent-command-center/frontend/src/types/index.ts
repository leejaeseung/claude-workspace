export type Team = 'code-quality' | 'feature-develop' | 'hr' | 'supervisor'
export type AgentStatus = 'idle' | 'on-mission'
export type MissionStatus = 'backlog' | 'in-progress' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high'
export type RelationType = 'mentoring' | 'lead' | 'collaboration' | 'supervision' | 'hr-lead'

export interface Agent {
  id: string
  displayName: string
  description: string
  team: Team
  level: number
  role: string
  avatar: string
  status: AgentStatus
}

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

export interface Relation {
  source: string
  target: string
  type: RelationType
  label: string
}

export interface StreamState {
  chunks: string
  isStreaming: boolean
}

export const TEAM_COLORS: Record<Team, { border: string; text: string; bg: string; glow: string; badge: string }> = {
  'code-quality': {
    border: 'border-blue-500',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    glow: 'shadow-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  },
  'feature-develop': {
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  },
  hr: {
    border: 'border-violet-500',
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    glow: 'shadow-violet-500/40',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/50',
  },
  supervisor: {
    border: 'border-amber-500',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    glow: 'shadow-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
  },
}

export const TEAM_LABELS: Record<Team, string> = {
  'code-quality': 'CODE QUALITY',
  'feature-develop': 'FEATURE DEV',
  hr: 'HR',
  supervisor: 'SUPERVISOR',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-slate-400 bg-slate-700',
  medium: 'text-yellow-400 bg-yellow-500/20',
  high: 'text-red-400 bg-red-500/20',
}

export type PermissionMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions'

export interface AgentPermissions {
  mode: PermissionMode
  allowedTools: string[]
}

export interface PermissionPreset {
  id: string
  label: string
  description: string
  icon: string
  permissions: AgentPermissions
}

export interface ToolGroup {
  id: string
  label: string
  tools: string[]
}

export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  default: '기본 (매번 확인)',
  acceptEdits: '편집 자동 승인',
  dontAsk: '묻지 않음',
  bypassPermissions: '모든 권한',
}
