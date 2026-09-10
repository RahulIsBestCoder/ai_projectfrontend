export type UserRole = 'ADMIN' | 'TECH_LEAD' | 'ENG_MANAGER' | 'DEVELOPER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  organizationId: string;
}

export interface Organization {
  id: string;
  name: string;
  githubOrg: string;
  taigaOrg: string;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  deadline: string;
  healthScore: number; // 0-100
  delayProbability: number; // 0-100%
  status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  keyRiskFactors: string[];
  lastSyncAt: string;
}

export interface GitHubRepository {
  id: string;
  projectId: string;
  repoName: string;
  defaultBranch: string;
  stars: number;
  openIssues: number;
  lastSyncAt: string;
}

export interface GitHubCommit {
  id: string;
  repositoryId: string;
  sha: string;
  author: string;
  authorAvatar?: string;
  commitDate: string;
  message: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface GitHubPullRequest {
  id: string;
  repositoryId: string;
  number: number;
  title: string;
  author: string;
  status: 'OPEN' | 'MERGED' | 'CLOSED';
  createdAt: string;
  mergedAt?: string;
  reviewTimeHours: number;
  commentsCount: number;
}

export interface GitHubContributor {
  id: string;
  repositoryId: string;
  username: string;
  avatarUrl: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
}

export interface TaigaSprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  completedPoints: number;
  isClosed: boolean;
}

export interface TaigaStory {
  id: string;
  projectId: string;
  sprintId: string;
  subject: string;
  storyPoints: number;
  status: 'BACKLOG' | 'IN_PROGRESS' | 'IN_TESTING' | 'DONE';
  assignedTo: string;
  type: 'FEATURE' | 'BUG' | 'REFACTOR' | 'TECH_DEBT';
}

export interface TaigaTask {
  id: string;
  storyId: string;
  subject: string;
  status: 'NEW' | 'IN_PROGRESS' | 'READY_FOR_TEST' | 'CLOSED';
  assignedTo: string;
}

export interface TaigaIssue {
  id: string;
  projectId: string;
  subject: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo: string;
  createdAt: string;
}

export type TeamRoleLevel = 'TECH_LEAD' | 'SENIOR' | 'JUNIOR' | 'FRESHER';

export interface DeveloperMetric {
  id: string;
  developerId: string;
  developerName: string;
  avatar: string;
  roleLevel: TeamRoleLevel;
  commitCount: number;
  codeChurn: number; // total lines changed
  reviewTimeHours: number; // avg PR review time
  bugsAssigned: number;
  bugsResolved: number;
  velocityPoints: number;
  aiScore: number; // 0-100 developer efficiency rating
  workloadStatus: 'OPTIMAL' | 'OVERLOADED' | 'UNDERUTILIZED';
}

export interface AIPrediction {
  id: string;
  projectId: string;
  delayProbability: number; // e.g. 78%
  predictedFinishDate: string; // ISO string
  confidence: number; // e.g. 89%
  projectHealth: number; // 0-100
  recommendations: string[];
  featureImportances: {
    feature: string;
    weight: number; // -100 to +100
    description: string;
  }[];
  teamCompositionSummary: {
    techLeads: number;
    seniors: number;
    juniors: number;
    freshers: number;
    qaCapacityPercentage: number;
  };
  aiProviderUsed: string;
  generatedAt: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'IN_PROGRESS';
  message: string;
  recordsSynced: {
    commits: number;
    prs: number;
    stories: number;
    tasks: number;
  };
}

export type AIProviderName = 'GEMINI' | 'OPENAI' | 'CLAUDE' | 'DEEPSEEK' | 'OLLAMA';

export interface AIProviderConfig {
  provider: AIProviderName;
  modelName: string;
  active: boolean;
  apiKeySet: boolean;
  endpointUrl?: string;
}

// ---------------------------------------------------------------------------
// Workforce — Departments, Teams, Employees, Org members
// ---------------------------------------------------------------------------

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
}

export interface DepartmentMetrics {
  departmentId: string;
  totalItems: number;
  statusBreakdown: Record<string, number>;
  completionRate: number; // 0-100
  plannedPoints: number;
  completedPoints: number;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  memberIds?: string[];
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  designation: string;
  departmentId?: string;
  role: UserRole;
}

export interface OrgMember {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Plans — AI sprint plan generator (POST /v1/plans). Shapes mirror
// planimplement.md §9, camelCased because `fromApi` runs on every response.
// ---------------------------------------------------------------------------

/** Request body for POST /v1/plans (sent through `toApi` -> snake_case). */
export interface GeneratePlanInput {
  description: string;
  projectName?: string;
  projectId?: string;
  teamSize?: number;
  durationWeeks?: number;
  sprintLengthWeeks?: number;
  startDate?: string; // YYYY-MM-DD
  constraints?: string[];
}

export interface PlanTask {
  title: string;
  description?: string;
  type?: string; // story | task | bug
  priority?: string; // low | medium | high | critical
  assigneeRole?: string; // frontend | backend | fullstack | qa | devops | design
  estimateHours?: number;
  storyPoints?: number;
}

export interface PlanSprint {
  index: number;
  name: string;
  goal?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  deadline: string;
  plannedPoints?: number;
  tasks: PlanTask[];
}

export interface PlanMilestone {
  name: string;
  date?: string;
  description?: string;
}

export interface PlanDeadline {
  label: string;
  date?: string;
}

export interface PlanRisk {
  description: string;
  severity?: string; // low | medium | high | critical
  mitigation?: string;
}

/** The `plan` object nested in the generate response / saved documents. */
export interface SprintPlan {
  planName: string;
  summary: string;
  totalDurationWeeks?: number;
  sprints: PlanSprint[];
  milestones?: PlanMilestone[];
  deadlines?: PlanDeadline[];
  risks?: PlanRisk[];
  assumptions?: string[];
  generatedBy?: string;
}

/** `dataset` of POST /v1/plans. */
export interface GeneratedPlan {
  id: string;
  generatedBy: 'google' | 'heuristic-fallback' | string;
  model: string;
  input: GeneratePlanInput;
  plan: SprintPlan;
}

/** A saved plan document from GET /v1/plans / GET /v1/plans/:id. */
export interface SavedPlan {
  id: string;
  projectId: string | null;
  title: string;
  input: GeneratePlanInput;
  plan: SprintPlan;
  provider: string;
  model: string;
  createdAt: string;
}

/**
 * The plan the team has committed to for a project. The backend has no plan
 * "status" field and no manual-create route, so this is persisted client-side
 * (localStorage, per project) — see `lib/acceptedPlan.ts`.
 */
export interface AcceptedPlanRecord {
  source: 'ai' | 'manual';
  acceptedAt: string; // ISO
  planId?: string; // backend id when source === 'ai'
  generatedBy?: string;
  model?: string;
  plan: SprintPlan; // possibly hand-edited
}

// ---------------------------------------------------------------------------
// Risk & Prediction
// ---------------------------------------------------------------------------

export interface ProjectRiskRow {
  id?: string;
  riskType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigated: boolean;
}

export interface RiskAnalyzeResult {
  score: number; // 0-1
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: Record<string, number>;
  topDriver?: string;
}

export interface CompletionForecast {
  p50: string;
  p80: string;
  p95: string;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface ReportItem {
  id: string;
  projectId: string;
  name: string;
  format?: 'pdf' | 'html' | 'ppt';
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  artifactUrl?: string;
  generatedAt?: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationTriggerType =
  | 'risk_alert'
  | 'deadline_slip'
  | 'sync_failed'
  | 'sprint_closeout'
  | 'report_ready'
  | 'mention'
  | 'assignment';

export interface AppNotification {
  id: string;
  type: NotificationTriggerType | string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  eventType: string;
  inApp: boolean;
  email: boolean;
}

// ---------------------------------------------------------------------------
// Analytics — health strategy / components / trends
// ---------------------------------------------------------------------------

export interface HealthStrategy {
  id: string;
  name: string;
}

export interface ProjectHealthDetail {
  score: number;
  calculationVersion: string;
  evaluationStrategy: string;
  lastEvaluated: string;
  components: Record<string, number>; // schedule|progress|velocity|quality|risk|delivery
}

export interface TrendPoint {
  date: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export interface IntegrationRow {
  id: string;
  provider: string; // github | gitlab | taiga | jira | planner | azure_devops | other
  repositoryName: string;
  repositoryUrl?: string;
  repositoryOrganization?: string;
  projectId?: string;
  status: number; // 0 inactive | 1 active | 2 error
  syncStatus?: string; // idle | syncing | success | partial | failed
  lastSyncAt?: string;
}

/** A row of GET /v1/integrations/:id/sync-history. */
export interface SyncHistoryRow {
  id?: string;
  createdAt: string;
  status: string; // success | partial | failed | error
  itemsSynced?: number;
  durationMs?: number;
  errorMessage?: string | null;
}
