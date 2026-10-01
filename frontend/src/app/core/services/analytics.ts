import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { rowsOf, oneOf, safeRead } from '@core/http/util';
import { CalculatedAnalytics } from '@core/services/analytics-calculator';
import {
  DeveloperMetric,
  HealthStrategy,
  ProjectHealthDetail,
  TrendPoint,
} from '@shared/models';
import type { PortfolioCompletionForecast, PortfolioProjectHealth } from './portfolio';

const scalar = (v: any): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

/** One stored metric: either a metric document `{ value, breakdown, ... }` or a bare number. */
function metricValue(...candidates: any[]): number | null {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const value = typeof candidate === 'object' ? candidate.value : candidate;
    const n = scalar(value);
    if (n != null) return n;
  }
  return null;
}

/**
 * Coerce the backend analytics bundle into the CalculatedAnalytics shape the
 * dashboard screens consume.
 *
 * The live route replies `{ project_id, latest, trends, summary }`, where every
 * metric (`progress` / `velocity` / `git_commits` / `git_pull_requests` /
 * `health` / `quality`) is a stored document under `latest` plus a time series
 * under `trends`. Older/simplified builds returned those groups at the root, so
 * both layouts are accepted. Missing groups are zero-filled so a partial payload
 * still renders — but a *null* health score is never turned into a fake 0, and
 * never flipped into a 100% delay probability.
 */
function coerceBundle(d: any): CalculatedAnalytics | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;

  // Already the full computed shape? pass through.
  if (d.prMetrics && d.sprintMetrics && d.bugMetrics && d.codeChurn && d.qaCapacity) {
    return d as CalculatedAnalytics;
  }

  // Keys arrive camelCased (`fromApi`), so tolerate `gitCommits` and `git_commits`.
  const latest = d.latest && typeof d.latest === 'object' && !Array.isArray(d.latest) ? d.latest : d;
  const summary = d.summary && typeof d.summary === 'object' && !Array.isArray(d.summary) ? d.summary : {};

  const progressDoc = latest.progress ?? d.progress;
  const healthScoreRaw =
    metricValue(latest.health, d.health, summary.health) ??
    scalar(latest.health?.score) ??
    scalar(d.healthScore);
  const completion =
    metricValue(progressDoc, summary.progress) ??
    scalar(progressDoc?.percentComplete ?? progressDoc?.percent_complete) ??
    0;
  const qualityScore = metricValue(latest.quality, d.quality, summary.quality) ?? scalar(latest.quality?.score);
  const velocityPoints = metricValue(latest.velocity, d.velocity, summary.velocity) ?? 0;
  const prCount =
    metricValue(latest.gitPullRequests, latest.git_pull_requests, d.gitPullRequests, d.git_commits) ?? 0;
  const riskScore = metricValue(latest.risk, d.risk, summary.risk);

  const healthScore = healthScoreRaw ?? 0;
  const delayProbability =
    riskScore != null
      ? Math.round(Math.max(0, Math.min(100, riskScore <= 1 ? riskScore * 100 : riskScore)))
      : healthScoreRaw != null
        ? Math.max(0, Math.round(100 - healthScoreRaw))
        : 0;

  return {
    healthScore,
    delayProbability,
    codeChurn: { additions: 0, deletions: 0, filesChanged: 0, churnRatio: 0 },
    // The bundle stores only a PR *count* (all_project_repositories); open/merged
    // splits, review latency and staleness come from the PR feed in OverviewDashboard.
    prMetrics: {
      totalPrs: prCount,
      openPrs: 0,
      mergedPrs: 0,
      avgReviewTimeHours: 0,
      stalePrCount: 0,
    },
    sprintMetrics: {
      totalPoints: velocityPoints,
      completedPoints: Math.round((velocityPoints * completion) / 100),
      completionPercentage: completion,
      velocityHistory: Array.isArray(d.velocityHistory) ? d.velocityHistory : [],
    },
    bugMetrics: {
      criticalBugs: 0,
      highBugs: 0,
      mediumBugs: 0,
      resolvedBugs: 0,
      // No defect-density metric is stored; only the AI quality score exists.
      bugDensityPerKLOC: 0,
    },
    qaCapacity: {
      devsCount: 0,
      qaCount: 0,
      ratio: '—',
      // The AI quality score is the only stored quality signal — use it as the
      // capacity proxy the old build tried to read from a `codeCoverage` metric.
      capacityPercentage: qualityScore ?? 0,
    },
  };
}

/** GET /v1/projects/:id/analytics — dashboard bundle. Null only when the route is
 *  unavailable or the payload is not an object. */
export async function getAnalytics(projectId: string): Promise<CalculatedAnalytics | null> {
  return safeRead(async () => {
    return coerceBundle(oneOf((await http.get(`/projects/${projectId}/analytics`)).data));
  }, null, 'analytics.bundle');
}

export async function getDeveloperMetrics(): Promise<DeveloperMetric[]> {
  return safeRead(async () => {
    const res = await http.get('/developers/metrics');
    return rowsOf<DeveloperMetric>(res.data);
  }, [], 'analytics.developers');
}

export async function getProjectHealth(projectId: string): Promise<ProjectHealthDetail | null> {
  return safeRead(async () => {
    const d = oneOf<any>((await http.get(`/projects/${projectId}/health`)).data);
    if (!d || typeof d !== 'object') return null;
    // The route returns `{ overall: { score }, dimensions: [...] }`; older builds used a flat `score`.
    const score = typeof d?.score === 'number' ? d.score : d?.overall?.score;
    const dimensionComponents = Object.fromEntries(
      (Array.isArray(d.dimensions) ? d.dimensions : [])
        .map((dim: any) => [dim.label || dim.metric, typeof dim?.value === 'number' ? dim.value : null])
    );
    return {
      score: typeof score === 'number' ? score : null,
      calculationVersion: d.calculationVersion || d.calculation_version || '',
      evaluationStrategy: d.evaluationStrategy || d.evaluation_strategy || '',
      lastEvaluated: d.lastEvaluated || d.last_evaluated || d.computedAt || '',
      components: d.components || dimensionComponents,
    };
  }, null, 'analytics.health');
}

export interface AiHealthAssessment {
  /** 0–100; null means the AI had not enough evidence (never treat as 0). */
  health: number | null;
  quality: number | null;
  confidencePercent: number;
  summary: string;
  limitations: string[];
  evidence: string[];
  sources: string[];
  assessedAt: string;
}

export interface AiAssessmentRefreshResult {
  projectId: string;
  sourceSync: unknown | null;
  assessment: AiHealthAssessment;
  health: PortfolioProjectHealth;
  completionForecast: PortfolioCompletionForecast;
  risks: unknown;
  deadlinePrediction: unknown;
  contextUpdated: boolean;
}

/**
 * POST /projects/:id/ai-assessment/refresh — AI health + quality scores, AI risk
 * analysis, deadline forecast and context rebuild. Long-running; never retried
 * automatically. `sync: false` skips the source sync (use after AI Sync).
 */
export async function refreshAiAssessment(
  projectId: string,
  options: { sync?: boolean } = {}
): Promise<AiAssessmentRefreshResult> {
  const res = await http.post(
    `/projects/${projectId}/ai-assessment/refresh`,
    { sync: options.sync ?? false },
    { timeout: 120_000 }
  );
  return fromApi(res.data) as AiAssessmentRefreshResult;
}

export interface RulesHealthSection {
  /** 0–100, or null when the section could not be scored (see `reason`). */
  score: number | null;
  weight: number;
  basis?: string;
  reason: string | null;
  numerator?: number;
  denominator?: number;
}

export type RulesHealthBand = 'HIGH' | 'AVERAGE' | 'LOW' | 'N/A';

export interface RulesHealth {
  asOf: string;
  /** Only set when coverage clears `minCoverage` and Feature + Sprint both scored. */
  value: number | null;
  band: RulesHealthBand;
  status: 'FINAL' | 'PROVISIONAL' | 'INSUFFICIENT_DATA';
  /** Weighted average over whatever did score — never show this as the official score. */
  provisionalScore: number | null;
  provisionalBand: RulesHealthBand;
  coverageWeight: number;
  minCoverage: number;
  sections: Record<string, RulesHealthSection>;
  reasons: string[];
  deliveryFlags: string[];
  rulesVersion: string;
}

/**
 * GET /projects/:id/health/rules-score — health computed from delivery data on
 * request. No AI call, nothing stored, so it can never shadow the AI health rows.
 */
export async function getRulesHealth(projectId: string): Promise<RulesHealth | null> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/health/rules-score`);
    return oneOf<RulesHealth>(res.data);
  }, null, 'analytics.rulesHealth');
}

export async function getHealthStrategies(projectId: string): Promise<HealthStrategy[]> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/health/strategies`);
    return rowsOf<HealthStrategy>(res.data);
  }, [], 'analytics.strategies');
}

export async function setHealthStrategy(projectId: string, strategyId: string) {
  const res = await http.put(`/projects/${projectId}/health/strategy`, toApi({ strategyId }));
  return res.data;
}

export async function getAnalyticsTrends(
  projectId: string,
  metric = 'health',
  days = 56
): Promise<TrendPoint[]> {
  return safeRead(async () => {
    const res = await http.get(
      `/projects/${projectId}/analytics/trends?metric=${metric}&period=daily&days=${days}`
    );
    const d = fromApi(res.data);
    // The route returns `points: [{ date, value }]` (plus `moving_avg` and `summary`).
    if (Array.isArray(d?.points)) return d.points;
    if (Array.isArray(d?.series)) return d.series;
    return rowsOf<TrendPoint>(res.data);
  }, [], 'analytics.trends');
}
