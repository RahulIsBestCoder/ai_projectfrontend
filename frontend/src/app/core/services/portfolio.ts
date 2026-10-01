import { http } from '@core/http/http';
import { fromApi } from '@core/http/case';
import { oneOf } from '@core/http/util';

export interface PortfolioProjectRow {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: string | number;
  healthScore?: number | null;
}

export interface PortfolioProjectHealth {
  project: { id: string; name: string; healthScore?: number | null };
  overall: { score: number | null; status: string; trend: string };
  dimensions: Array<{
    metric: string;
    label: string;
    value: number | null;
    weekAvg: number | null;
    delta7d: number | null;
    trend: string;
    status: string;
  }>;
  assessment: {
    health: number | null;
    quality: number | null;
    confidencePercent: number;
    summary: string;
    limitations: string[];
    evidence: string[];
    sources: string[];
    assessedAt: string | null;
  } | null;
  risk: {
    latest: {
      level: string;
      summary: string;
      factors: string[];
      confidenceScore: number;
      createdAt: string;
    } | null;
    counts: Record<string, number>;
  };
  computedAt: string;
}

export interface PortfolioCompletionForecast {
  confidence?: 'high' | 'medium' | 'low';
  remainingStoryPoints?: number | null;
  velocity?: { average?: number | null; stdDev?: number | null; sprintsObserved?: number };
  forecast?: {
    status?: 'complete' | 'insufficient_data' | 'simulated';
    onTimeProbability?: number | null;
    p50?: string | null;
    p80?: string | null;
    p95?: string | null;
    optimistic?: string | null;
  };
}

export interface PortfolioProjectCard {
  id: string;
  name: string;
  description: string;
  healthScore: number | null;
  healthStatus: string;
  healthTrend: string;
  deliveryStatus: 'on_track' | 'at_risk' | 'off_track' | 'unknown';
  openRisks: number;
  delayPercent: number | null;
  predictedCompletionDate: string | null;
  remainingStoryPoints: number | null;
  forecastConfidence: string | null;
  forecastStatus: string | null;
  healthUnavailable: boolean;
  forecastUnavailable: boolean;
}

export interface PortfolioProjectList {
  rows: PortfolioProjectRow[];
  total: number;
}

/**
 * `GET /projects/ai-dashboard` — built only from each project's latest saved
 * report (no AI calls). Keys arrive camelCased via `fromApi`, including map
 * keys such as `features.notImplemented`.
 */
export interface AiDashboardTaskCounts {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  notStarted: number;
}

export interface AiDashboardCard {
  project: { id: string; name: string | null; status: string | number | null };
  report: { id: string | null; status: string | null; generatedAt: string | null; generatedBy: string | null; stale: boolean };
  implementation: {
    completePercent: number | null;
    remainingPercent: number | null;
    basis: string | null;
    tasks: AiDashboardTaskCounts;
    features: Record<string, number>;
  } | null;
  health: { score: number | null; status: string; trend: string; previousScore: number | null } | null;
  velocity: { value: number | null; previous: number | null; trend: string; sprintName: string | null; completionRate: number | null } | null;
  risk: { overall: string; deadline: string; top: unknown[] } | null;
  /** `deadlineProbability` is a 0–1 fraction in current reports. */
  forecast: { deadlineProbability: number | null; expectedCompletionDate: string | null } | null;
  summary: { text: string | null; needsAttention: unknown[]; recommendations: unknown[] } | null;
}

export interface AiDashboardTotals {
  reports: { totalProjects: number; withReport: number; missing: number; stale: number; generating: number };
  implementation: {
    completePercent: number | null;
    remainingPercent: number | null;
    tasks: AiDashboardTaskCounts;
    features: Record<string, number>;
  };
  health: { avgScore: number | null; byStatus: Record<string, number> };
  risk: { byOverall: Record<string, number>; byDeadline: Record<string, number> };
  forecast: { avgDeadlineProbability: number | null; latestExpectedCompletionDate: string | null };
}

export interface AiDashboard {
  totals: AiDashboardTotals;
  rows: AiDashboardCard[];
  total: number;
  computedAt: string;
}

export async function getAiDashboard(ids?: string[]): Promise<AiDashboard> {
  const data = fromApi((await http.get('/projects/ai-dashboard', {
    params: { page: 1, limit: 100, ...(ids?.length ? { ids: ids.join(',') } : {}) },
  })).data);
  if (!data?.totals) throw new Error('AI dashboard is unavailable.');
  return data as AiDashboard;
}

export async function getPortfolioOrganization(id: string): Promise<{ id: string; name: string }> {
  const organization = oneOf<any>((await http.get(`/organizations/${id}`)).data);
  if (!organization) throw new Error('Organization was not found.');
  return fromApi(organization);
}

export async function getPortfolioProjects(
  organizationId: string,
  archiveScope: 'main' | 'archived' | 'all' = 'main',
): Promise<PortfolioProjectList> {
  const data = fromApi((await http.get('/projects', {
    params: { organization_id: organizationId, archive_scope: archiveScope, page: 1, limit: 100 },
  })).data);
  return {
    rows: Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [],
    total: Number(data?.total ?? data?.count ?? (Array.isArray(data) ? data.length : 0)),
  };
}

export async function getPortfolioProjectHealth(projectId: string): Promise<PortfolioProjectHealth> {
  const data = oneOf<PortfolioProjectHealth>((await http.get(`/projects/${projectId}/health`)).data);
  if (!data) throw new Error('Health data is unavailable.');
  const returnedProjectId = String(data.project?.id || '');
  if (returnedProjectId && returnedProjectId !== String(projectId)) {
    throw new Error(
      `Health response project mismatch: requested ${projectId}, received ${returnedProjectId}.`,
    );
  }
  return data;
}

export async function getPortfolioCompletionForecast(projectId: string): Promise<PortfolioCompletionForecast> {
  const data = oneOf<PortfolioCompletionForecast>(
    (await http.get(`/projects/${projectId}/predictions/completion`)).data
  );
  if (!data) throw new Error('Completion prediction is unavailable.');
  return data;
}

export async function syncPortfolioProject(projectId: string): Promise<void> {
  await http.post(`/projects/${projectId}/sync`, {}, { timeout: 180_000 });
}

export async function generatePortfolioDeadlinePrediction(projectId: string): Promise<void> {
  await http.post(`/projects/${projectId}/predictions/deadline`, {}, { timeout: 180_000 });
}
