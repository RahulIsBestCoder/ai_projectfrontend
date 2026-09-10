import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import {
  AIPrediction,
  ProjectRiskRow,
  RiskAnalyzeResult,
  CompletionForecast,
} from '@/types';

const SEVERITY_FROM_API: Record<string, ProjectRiskRow['severity']> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

/** Normalise whatever `/predictions` returns into the full AIPrediction shape the
 *  screens map over (they call `.recommendations.map` / `.featureImportances.map`
 *  with only an optional-chain on `prediction` itself). */
function toPrediction(projectId: string, d: any): AIPrediction | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const delayProbability =
    d.delayProbability ??
    (typeof d.confidence === 'number' ? d.confidence : undefined) ??
    0;
  return {
    id: d.id || `pred-${projectId}`,
    projectId,
    delayProbability,
    predictedFinishDate: d.predictedFinishDate || d.completionDate || d.completion_date || '',
    confidence: d.confidence ?? 0,
    projectHealth: d.projectHealth ?? d.health ?? 0,
    recommendations: Array.isArray(d.recommendations) ? d.recommendations : [],
    featureImportances: Array.isArray(d.featureImportances) ? d.featureImportances : [],
    teamCompositionSummary:
      d.teamCompositionSummary || {
        techLeads: 0,
        seniors: 0,
        juniors: 0,
        freshers: 0,
        qaCapacityPercentage: 0,
      },
    aiProviderUsed: d.aiProviderUsed || '',
    generatedAt: d.generatedAt || new Date().toISOString(),
  };
}

export async function getRiskPrediction(projectId: string): Promise<AIPrediction | null> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/predictions`);
    // dataset may be [] (no prediction yet), a single object, or an array of rows
    return toPrediction(projectId, oneOf(res.data));
  }, null, 'risk.prediction');
}

/**
 * There is no `/predictions/run` route. "Recalculate" maps to running the risk
 * analysis (`POST /projects/:id/risks/analyze`) and reshaping it into a prediction.
 */
export async function runAIPrediction(projectId: string, activeProvider = 'gemini') {
  const [analysis, existing] = await Promise.all([
    analyzeRisk(projectId),
    getRiskPrediction(projectId),
  ]);
  const delayProbability = Math.round(analysis.score * 100);
  const featureImportances = Object.entries(analysis.signals).map(([feature, v]) => ({
    feature,
    weight: Math.min(100, Math.round(Math.abs(Number(v)) * 40)),
    description: `${feature.replace(/_/g, ' ')}: ${v}`,
  }));
  return {
    ...(existing ?? toPrediction(projectId, {})!),
    delayProbability,
    confidence: existing?.confidence || delayProbability,
    featureImportances: featureImportances.length ? featureImportances : existing?.featureImportances ?? [],
    aiProviderUsed: activeProvider,
    generatedAt: new Date().toISOString(),
  } as AIPrediction;
}

export async function listRisks(projectId: string): Promise<ProjectRiskRow[]> {
  return safeRead(async () => {
    const rows = rowsOf<any>((await http.get(`/projects/${projectId}/risks`)).data);
    return rows.map((r) => ({
      id: r.id,
      riskType: r.riskType || r.risk_type || 'general',
      severity: SEVERITY_FROM_API[String(r.severity || '').toLowerCase()] || 'MEDIUM',
      description: r.description || '',
      mitigated: !!r.mitigated,
    }));
  }, [], 'risk.list');
}

export async function analyzeRisk(projectId: string): Promise<RiskAnalyzeResult> {
  const res = await http.post(`/projects/${projectId}/risks/analyze`, {});
  const d = fromApi(res.data);
  return {
    score: d.score ?? 0,
    level: (d.level || 'LOW') as RiskAnalyzeResult['level'],
    signals: d.signals || {},
    topDriver: d.topDriver || d.top_driver,
  };
}

export async function predictDeadline(
  projectId: string,
  targetDate: string
): Promise<{ probability: number }> {
  const res = await http.post(`/projects/${projectId}/predictions/deadline`, toApi({ targetDate }));
  const d = fromApi(res.data);
  return { probability: d.probability ?? 0 };
}

export async function getCompletionForecast(projectId: string): Promise<CompletionForecast | null> {
  return safeRead(async () => {
    const d = oneOf<any>((await http.get(`/projects/${projectId}/predictions/completion`)).data);
    if (!d || d.p50 == null) return null;
    return d as CompletionForecast;
  }, null, 'risk.completion');
}
