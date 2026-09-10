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
// Plans — AI sprint-distribution drafting
// ---------------------------------------------------------------------------

export interface PlanSprint {
  name: string;
  goal: string;
  durationDays: number;
  features: string[];
}

export interface Plan {
  id: string;
  projectId: string;
  name: string;
  features?: string[];
  requirements?: string;
  deadline?: string;
  sprintDistribution?: { sprints: PlanSprint[] } | null;
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
  provider: 'github' | 'taiga';
  repositoryName: string;
  repositoryUrl?: string;
  status: number; // 0 inactive | 1 active | 2 error
}

export interface SyncHistoryRow {
  syncedAt: string;
  status: string;
  message: string;
}
