export type Team = 'code-quality' | 'feature-develop' | 'hr' | 'supervisor'
export type RelationType = 'mentoring' | 'lead' | 'collaboration' | 'supervision' | 'hr-lead'

export interface AgentStaticData {
  displayName: string
  team: Team
  level: number
  role: string
  avatar: string
}

export interface Relation {
  source: string
  target: string
  type: RelationType
  label: string
}

export const agentStaticData: Record<string, AgentStaticData> = {
  'code-quality-leader': {
    displayName: '김도현',
    team: 'code-quality',
    level: 22,
    role: 'Code Quality Leader',
    avatar: '도',
  },
  'code-quality-oop-patterns-expert': {
    displayName: '박지수',
    team: 'code-quality',
    level: 11,
    role: 'OOP Patterns Expert',
    avatar: '지',
  },
  'code-quality-refactoring-specialist': {
    displayName: '이준혁',
    team: 'code-quality',
    level: 13,
    role: 'Refactoring Specialist',
    avatar: '준',
  },
  'code-quality-test-engineer': {
    displayName: '최아린',
    team: 'code-quality',
    level: 9,
    role: 'Test Engineer',
    avatar: '아',
  },
  'feature-develop-leader': {
    displayName: '박지훈',
    team: 'feature-develop',
    level: 8,
    role: 'Feature Dev Leader',
    avatar: '훈',
  },
  'feature-develop-developer-1': {
    displayName: '강민서',
    team: 'feature-develop',
    level: 6,
    role: 'Mid-level Developer',
    avatar: '민',
  },
  'feature-develop-developer-2': {
    displayName: '하진우',
    team: 'feature-develop',
    level: 12,
    role: 'Senior Developer',
    avatar: '진',
  },
  'hr-chief': {
    displayName: 'HR Chief',
    team: 'hr',
    level: 10,
    role: 'HR Chief',
    avatar: 'HR',
  },
  'hr-evaluator-1': {
    displayName: '기술 평가관',
    team: 'hr',
    level: 5,
    role: 'Tech Evaluator',
    avatar: 'T1',
  },
  'hr-evaluator-2': {
    displayName: '소통 평가관',
    team: 'hr',
    level: 5,
    role: 'Comms Evaluator',
    avatar: 'T2',
  },
  'hr-evaluator-3': {
    displayName: '창의 평가관',
    team: 'hr',
    level: 5,
    role: 'Creative Evaluator',
    avatar: 'T3',
  },
  'agent-supervisor': {
    displayName: 'Sebastian Choi',
    team: 'supervisor',
    level: 15,
    role: 'Agent Supervisor',
    avatar: 'SC',
  },
}

export const relations: Relation[] = [
  { source: 'agent-supervisor', target: 'code-quality-leader', type: 'supervision', label: '감독' },
  { source: 'agent-supervisor', target: 'feature-develop-leader', type: 'supervision', label: '감독' },
  { source: 'agent-supervisor', target: 'hr-chief', type: 'supervision', label: '감독' },
  { source: 'code-quality-leader', target: 'code-quality-oop-patterns-expert', type: 'mentoring', label: '멘토링' },
  { source: 'code-quality-leader', target: 'code-quality-refactoring-specialist', type: 'mentoring', label: '멘토링' },
  { source: 'code-quality-leader', target: 'code-quality-test-engineer', type: 'mentoring', label: '멘토링' },
  { source: 'code-quality-refactoring-specialist', target: 'code-quality-oop-patterns-expert', type: 'collaboration', label: '페어프로그래밍' },
  { source: 'feature-develop-leader', target: 'feature-develop-developer-1', type: 'lead', label: '리드' },
  { source: 'feature-develop-leader', target: 'feature-develop-developer-2', type: 'lead', label: '리드' },
  { source: 'hr-chief', target: 'hr-evaluator-1', type: 'hr-lead', label: '지휘' },
  { source: 'hr-chief', target: 'hr-evaluator-2', type: 'hr-lead', label: '지휘' },
  { source: 'hr-chief', target: 'hr-evaluator-3', type: 'hr-lead', label: '지휘' },
]
