export const ENUM = {
  workItemStatus: {
    toApi: { BACKLOG: 'todo', IN_PROGRESS: 'in_progress', IN_TESTING: 'blocked', DONE: 'done', CANCELLED: 'cancelled' },
    fromApi: { todo: 'BACKLOG', in_progress: 'IN_PROGRESS', blocked: 'IN_TESTING', done: 'DONE', cancelled: 'CANCELLED' },
  },
  workItemType: {
    toApi: { FEATURE: 'story', BUG: 'bug', REFACTOR: 'task', TECH_DEBT: 'task' },
    fromApi: { story: 'FEATURE', task: 'REFACTOR', bug: 'BUG', epic: 'FEATURE', subtask: 'TECH_DEBT' },
  },
  prStatus: {
    toApi: { OPEN: 'open', MERGED: 'merged', CLOSED: 'closed' },
    fromApi: { open: 'OPEN', merged: 'MERGED', closed: 'CLOSED' },
  },
  severity: {
    toApi: { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' },
    fromApi: {
      critical: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
      normal: 'MEDIUM',
      minor: 'LOW',
      blocker: 'CRITICAL',
      trivial: 'LOW',
    },
  },
  role: {
    toApi: { ADMIN: 'super_admin', TECH_LEAD: 'project_manager', ENG_MANAGER: 'member', DEVELOPER: 'member' },
    fromApi: {
      super_admin: 'ADMIN',
      org_admin: 'ADMIN',
      project_manager: 'TECH_LEAD',
      member: 'DEVELOPER',
      viewer: 'DEVELOPER',
    },
  },
};

export const mapEnum = (table: Record<string, string>, v: string, dflt = v): string => table[v] ?? dflt;
