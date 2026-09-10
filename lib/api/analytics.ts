import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import { CalculatedAnalytics } from '@/lib/analytics/calculator';
import {
  DeveloperMetric,
  HealthStrategy,
  ProjectHealthDetail,
  TrendPoint,
} from '@/types';

const num = (v: any, dflt = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : dflt);

/** Coerce the backend analytics bundle `{ health, progress, velocity, quality, risk }`
 *  into the CalculatedAnalytics shape the dashboard screens consume. Missing groups
 *  are zero-filled so a partial payload still renders instead of an empty screen. */
function coerceBundle(d: any): CalculatedAnalytics | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;

  // Already the full computed shape? pass through.
  if (d.prMetrics && d.sprintMetrics && d.bugMetrics && d.codeChurn && d.qaCapacity) {
    return d as CalculatedAnalytics;
  }

  const health = typeof d.health === 'object' ? d.health : { score: d.health };
  const progress = d.progress || {};
  const velocity = d.velocity || {};
  const quality = d.quality || {};
  const risk = d.risk || {};

  const healthScore = num(health.score, num(d.healthScore, 0));
  const completion = num(progress.percentComplete ?? progress.percent_complete, 0);
  const delayProbability = num(
    risk.score != null ? risk.score * (risk.score <= 1 ? 100 : 1) : undefined,
    Math.max(0, 100 - healthScore)
  );

  return {
    healthScore,
    delayProbability,
    codeChurn: { additions: 0, deletions: 0, filesChanged: 0, churnRatio: 0 },
    prMetrics: { totalPrs: 0, openPrs: 0, mergedPrs: 0, avgReviewTimeHours: 0, stalePrCount: 0 },
    sprintMetrics: {
      totalPoints: num(velocity.points, 0),
      completedPoints: Math.round((num(velocity.points, 0) * completion) / 100),
      completionPercentage: completion,
      velocityHistory: Array.isArray(d.velocityHistory) ? d.velocityHistory : [],
    },
    bugMetrics: {
      criticalBugs: 0,
      highBugs: 0,
      mediumBugs: 0,
      resolvedBugs: 0,
      bugDensityPerKLOC: num(quality.defectDensity ?? quality.defect_density, 0),
    },
    qaCapacity: {
      devsCount: 0,
      qaCount: 0,
      ratio: '—',
      capacityPercentage: num(quality.codeCoverage ?? quality.code_coverage, 0),
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
    if (!d || typeof d.score !== 'number') return null;
    return {
      score: d.score,
      calculationVersion: d.calculationVersion || d.calculation_version || '',
      evaluationStrategy: d.evaluationStrategy || d.evaluation_strategy || '',
      lastEvaluated: d.lastEvaluated || d.last_evaluated || '',
      components: d.components || {},
    };
  }, null, 'analytics.health');
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
    if (Array.isArray(d?.series)) return d.series;
    return rowsOf<TrendPoint>(res.data);
  }, [], 'analytics.trends');
}
