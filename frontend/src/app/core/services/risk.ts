import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { oneOf, safeRead } from '@core/http/util';
import {
  AIPrediction,
  CompletionForecast,
  RiskAnalysisResult,
  RiskListResult,
  RiskLevel,
  RiskRow,
} from '@shared/models';

/** 0-100 delay probability implied by a stored risk level. Mirrors the mapping in
 *  `runAIPrediction` so the sidebar, Overview and the AI tab agree. */
const LEVEL_TO_DELAY_RISK: Record<string, number> = {
  CRITICAL: 88,
  HIGH: 66,
  MEDIUM: 42,
  LOW: 18,
};

const numOrNull = (v: any): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

/** First value that is a number greater than zero (0/undefined are "unset" signals). */
function positiveNumber(...values: any[]): number | null {
  for (const value of values) {
    const n = numOrNull(value);
    if (n != null && n > 0) return n;
  }
  return null;
}

/**
 * Some routes (`/projects/:id/predictions`) serialize raw Mongoose documents, so
 * the real fields sit under `_doc` beside the `$__` / `$isNew` internals. Note
 * `fromApi` camelCases `_doc` to `Doc` — with a capital D, because the leading
 * underscore has no preceding character to keep lowercase — so all three spellings
 * are checked. A few values (`predicted_finish_date`) are plain virtuals on the
 * wrapper; flattening both layers lets either lookup work.
 */
function unwrapDoc(row: any): any {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const inner = row.Doc ?? row.doc ?? row._doc;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return row;
  const merged: Record<string, any> = { ...inner };
  for (const [key, value] of Object.entries(row)) {
    if (key === 'Doc' || key === 'doc' || key === '_doc' || key === '$__' || key === '$isNew') continue;
    if (value !== undefined && merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

/**
 * The `/predictions` dataset is `{ rows, count, risks, predictions }`. The stored
 * deadline record lives in `predictions` (a `risk_key: 'deadline'` / `kind:
 * 'prediction'` row); `rows` and `risks` carry the plain risk rows. Mapping the
 * container object instead finds no date and no probability — that is what put
 * "Invalid Date" and 0% on the AI screen.
 */
function pickPredictionRow(d: any): any {
  const lists: any[][] = [];
  if (Array.isArray(d)) lists.push(d);
  if (Array.isArray(d?.predictions)) lists.push(d.predictions);
  if (Array.isArray(d?.rows)) lists.push(d.rows);
  for (const list of lists) {
    // Unwrap before matching: the deadline row's `kind`, `risk_key` and `risk_level`
    // all live inside `_doc`, so matching the raw wrapper finds nothing.
    const rows = list.filter((row) => row && typeof row === 'object').map(unwrapDoc);
    const hit =
      rows.find((row) => String(row.kind || '').toLowerCase() === 'prediction') ||
      rows.find((row) => String(row.riskKey || row.risk_key || '').toLowerCase() === 'deadline') ||
      rows.find(
        (row) =>
          row.predictedFinishDate ||
          row.predictedDate ||
          row.predicted_finish_date ||
          row.predicted_date,
      );
    if (hit) return hit;
  }
  return d;
}

/** Normalise whatever `/predictions` returns into the full AIPrediction shape the
 *  screens map over (they call `.recommendations.map` / `.featureImportances.map`
 *  with only an optional-chain on `prediction` itself). */
function toPrediction(projectId: string, raw: any): AIPrediction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Unwrap a serialized Mongoose document, otherwise `risk_level` / `risk_key` are
  // invisible and only the wrapper's virtuals (a finish date) come through.
  const d = unwrapDoc(raw);

  // `on_time_probability` (0-1) is the modelled number. When the forecast had too
  // little history it is null and only `risk_level` is stored, so fall back to the
  // same risk-level mapping `runAIPrediction` uses rather than reporting 0%.
  const onTime = numOrNull(d.onTimeProbability);
  const level = String(d.riskLevel || d.risk_level || '').toUpperCase();
  const onTimeDelay = onTime != null ? Math.round((1 - Math.max(0, Math.min(1, onTime))) * 100) : null;
  const delayProbability =
    numOrNull(d.delayProbability) ?? numOrNull(d.delayProbabilityPct) ?? onTimeDelay ?? LEVEL_TO_DELAY_RISK[level] ?? 0;

  // `confidence_score` is unset (0) on the stored deadline row, so preferring it
  // would always read 0%. Take the first signal that actually carries a value, and
  // fall back to the forecast's data-quality score (the `FORECAST_DATA_QUALITY`
  // basis the delay endpoint documents) rather than reporting a bare 0%.
  const confidence =
    positiveNumber(d.confidence, d.confidencePercent, d.confidencePct) ??
    (typeof d.confidenceScore === 'number' && d.confidenceScore > 0
      ? Math.round(d.confidenceScore * 100)
      : null) ??
    (typeof d.dataQualityScore === 'number' ? Math.round(d.dataQualityScore) : 0);

  return {
    id: d.id || `pred-${projectId}`,
    projectId,
    delayProbability,
    predictedFinishDate:
      d.predictedFinishDate || d.predictedDate || d.completionDate || d.completion_date || '',
    confidence,
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
    // dataset is `{ rows, count, risks, predictions }` — empty when nothing is stored.
    return toPrediction(projectId, pickPredictionRow(fromApi(res.data)));
  }, null, 'risk.prediction');
}

// ---------------------------------------------------------------------------
// Risk analyze — POST /v1/projects/:id/risks/analyze  (one Gemini call)
//   - idempotent: re-running updates deterministic rows in place and replaces
//     the AI rows; hand-created risk rows are never touched.
//   - GET /v1/projects/:id/risks(?level=) lists the stored rows (sorted by
//     severity) and includes manual rows (which have no `source`).
// ---------------------------------------------------------------------------

const ANALYZE_TIMEOUT_MS = 120_000;

const LEVEL_ORDER: Record<RiskLevel, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

export async function analyzeProjectRisks(projectId: string): Promise<RiskAnalysisResult> {
  const res = await http.post(`/projects/${projectId}/risks/analyze`, {}, { timeout: ANALYZE_TIMEOUT_MS });
  const d = fromApi(res.data);
  return {
    projectId: d.projectId || projectId,
    generatedAt: d.generatedAt || new Date().toISOString(),
    overallRiskLevel: (d.overallRiskLevel || 'LOW') as RiskLevel,
    counts: d.counts || {},
    aiUsed: !!d.aiUsed,
    risks: Array.isArray(d.risks) ? (d.risks as RiskAnalysisResult['risks']) : [],
  };
}

export async function listProjectRisks(
  projectId: string,
  level?: RiskLevel,
): Promise<RiskListResult> {
  return safeRead(
    async () => {
      const res = await http.get(`/projects/${projectId}/risks`, {
        params: level ? { level } : undefined,
      });
      const d = fromApi(res.data);
      // dataset is `{ rows, count, counts, top_risk }`; tolerate a bare array too.
      const rows = (Array.isArray(d) ? d : Array.isArray(d?.rows) ? d.rows : []) as RiskRow[];
      return {
        rows,
        count: typeof d?.count === 'number' ? d.count : rows.length,
        counts: d?.counts || {},
        topRisk: d?.topRisk ?? null,
      };
    },
    { rows: [], count: 0, counts: {}, topRisk: null },
    'risk.list',
  );
}

/**
 * There is no `/predictions/run` route. "Recalculate" maps to running the risk
 * analysis and reshaping its result into the `AIPrediction` the screens render.
 */
const LEVEL_TO_DELAY: Record<RiskLevel, number> = { CRITICAL: 88, HIGH: 66, MEDIUM: 42, LOW: 18 };

export async function runAIPrediction(projectId: string, activeProvider = 'gemini') {
  const [analysis, existing] = await Promise.all([
    analyzeProjectRisks(projectId),
    getRiskPrediction(projectId),
  ]);

  const hot = (analysis.counts.CRITICAL || 0) + (analysis.counts.HIGH || 0);
  const delayProbability = Math.min(
    98,
    LEVEL_TO_DELAY[analysis.overallRiskLevel] + Math.min(10, hot * 3),
  );

  const ranked = [...analysis.risks].sort(
    (a, b) => LEVEL_ORDER[b.riskLevel] - LEVEL_ORDER[a.riskLevel],
  );
  const featureImportances = ranked.slice(0, 6).map((r) => ({
    feature: r.riskKey,
    weight: LEVEL_TO_DELAY[r.riskLevel],
    description: r.summary,
  }));
  const recommendations = ranked
    .map((r) => r.mitigation)
    .filter((m): m is string => !!m)
    .slice(0, 5);

  return {
    ...(existing ?? toPrediction(projectId, {})!),
    delayProbability,
    confidence: existing?.confidence || Math.round((ranked[0]?.confidenceScore ?? 0.6) * 100),
    featureImportances: featureImportances.length
      ? featureImportances
      : existing?.featureImportances ?? [],
    recommendations: recommendations.length
      ? recommendations
      : existing?.recommendations ?? [],
    aiProviderUsed: analysis.aiUsed ? activeProvider : `${activeProvider} (rules only)`,
    generatedAt: analysis.generatedAt,
  } as AIPrediction;
}

export interface DeadlineQualityComponent {
  value: number | null;
  weight: number;
  basis: string;
}

/** `POST /projects/:id/predictions/deadline` (rule-based, deterministic, no sync). Keys camelCased by `fromApi`. */
export interface DeadlinePrediction {
  projectId: string;
  /** `YYYY-MM-DD`, or null when no date can be forecast. */
  predictedDeadlineDate: string | null;
  /** 0–100 chance of meeting the deadline (`deadline_meet_percentage`); null when unavailable. */
  deadlineMeetPercentage: number | null;
  generatedAt: string;
  riskLevel: string;
  predictedDate: string | null;
  targetDate: string | null;
  /** 0–1; null when there is no representative history. */
  onTimeProbability: number | null;
  confidence: string | null;
  confidenceScore: number | null;
  dataQuality: {
    label: string;
    score: number | null;
    coverageWeight: number | null;
    components: Record<string, DeadlineQualityComponent>;
  } | null;
  calibration: string | null;
  summary: string;
  explanation: {
    generatedBy: string;
    provider: string | null;
    model: string | null;
    validation: string | null;
    summary: string;
    drivers: unknown[];
    risks: unknown[];
    actions: unknown[];
    missingData: unknown[];
  } | null;
  velocity: { model: string; windowWorkingDays: number; acceptedInWindow: number; perWorkingDay: number } | null;
  remainingItems: number | null;
  remainingStoryPoints: number | null;
  flags: string[];
  reasons: string[];
  ruleForecast: {
    modelVersion: string;
    rulesVersion: string;
    asOf: string;
    workUnit: string;
    basis: string;
    targetSource: string;
    status: string;
    scope: { totalItems: number; remainingItems: number; startedItems?: number; acceptedItems: number; remainingBasis: string } | null;
    deterministic: {
      predictedRemainingWorkingDays: number | null;
      predictedFinishDate: string | null;
      targetDate: string | null;
      availableWorkingDays: number | null;
      requiredVelocityPerWorkingDay: number | null;
      slackWorkingDays: number | null;
      capacityRatio: number | null;
      dependencies: string | null;
      accuracyLabel: string | null;
    } | null;
    probability: {
      onTime: number | null;
      p50: string | null;
      p80: string | null;
      p90: string | null;
      reason: string | null;
      calibration: string | null;
    } | null;
  } | null;
  factors: string[];
}

/**
 * The target date comes from the latest plan deadline on the backend; no body is needed.
 * The route currently returns a slim payload (e.g. `{ project_id, deadline_meet_percentage }`),
 * so every list/object field is defaulted — the panel must never map over `undefined`.
 */
export async function predictDeadline(projectId: string): Promise<DeadlinePrediction> {
  const res = await http.post(`/projects/${projectId}/predictions/deadline`, {}, { timeout: 180_000 });
  const d: any = fromApi(res.data) ?? {};
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    ...d,
    projectId: d.projectId ?? projectId,
    predictedDeadlineDate:
      d.predictedDeadlineDate ?? (d.predictedDate ? String(d.predictedDate).slice(0, 10) : null),
    deadlineMeetPercentage: typeof d.deadlineMeetPercentage === 'number' && Number.isFinite(d.deadlineMeetPercentage)
      ? Math.max(0, Math.min(100, d.deadlineMeetPercentage))
      : typeof d.onTimeProbability === 'number'
        ? Math.round((d.onTimeProbability <= 1 ? d.onTimeProbability * 100 : d.onTimeProbability))
        : null,
    riskLevel: typeof d.riskLevel === 'string' ? d.riskLevel : '',
    onTimeProbability: typeof d.onTimeProbability === 'number' ? d.onTimeProbability : null,
    summary: typeof d.summary === 'string' ? d.summary : '',
    flags: list(d.flags),
    reasons: list(d.reasons),
    factors: list(d.factors),
    dataQuality: d.dataQuality ?? null,
    explanation: d.explanation ?? null,
    velocity: d.velocity ?? null,
    ruleForecast: d.ruleForecast ?? null,
  } as DeadlinePrediction;
}

/**
 * `GET /projects/:id/predictions/completion`. The Monte-Carlo dates live under
 * `forecast` (`{ status, p50, p80, p95, message }`) and the flat `p50` the screen
 * reads never exists — which made this return `null` for every project. Older
 * builds that did put `p50` at the root are still accepted. The object is returned
 * whenever the route replies, so the UI can show `status: insufficient_data` and
 * its message instead of a silently empty card.
 */
export async function getCompletionForecast(projectId: string): Promise<CompletionForecast | null> {
  return safeRead(async () => {
    const d: any = oneOf<any>((await http.get(`/projects/${projectId}/predictions/completion`)).data);
    if (!d) return null;
    const forecast = d.forecast && typeof d.forecast === 'object' ? d.forecast : d;
    return {
      ...d,
      p50: forecast.p50 ?? null,
      p80: forecast.p80 ?? null,
      p95: forecast.p95 ?? null,
      onTimeProbability: numOrNull(d.onTimeProbability) ?? numOrNull(forecast.onTimeProbability),
      confidencePct: numOrNull(d.confidencePct) ?? numOrNull(d.confidencePercent),
      status: forecast.status ?? null,
      message: forecast.message ?? null,
    } as CompletionForecast;
  }, null, 'risk.completion');
}

// ---------------------------------------------------------------------------
// Delay sensitivity ("Predictive Intelligence Center") — see
// docs/delay_prediction_ui_instructions.md. Read-only: no AI call, no sync, so
// it is safe to call on mount and on every slider release.
//   GET  /v1/projects/:id/ai/delay-prediction          -> deterministic baseline
//   POST /v1/projects/:id/ai/delay-prediction/simulate -> scenario + per-driver points
// ---------------------------------------------------------------------------

export type DelayDriverKey =
  | 'prReviewLatencyHours'
  | 'sprintVelocityDeficitPercent'
  | 'criticalBugs'
  | 'qaCapacityPercent';

export interface DelayDriver {
  /** Current value, or null when the project does not track this signal. */
  baseline: number | null;
  /** Where the baseline came from, e.g. "140 merged pull requests". */
  source: string | null;
  /** Why there is no baseline, e.g. `NO_BUG_SEVERITY_TRACKED`. */
  reason: string | null;
}

export interface DelaySensitivity {
  /** Points this driver can add at its worst value. */
  maxPoints: number;
  /** The worst value the driver is scored against. */
  reference: number;
  unit: string;
  label: string;
}

export interface DelayFeatureImportance {
  feature: string;
  weight: number;
  description: string;
  /** `forecast` (a delivery flag) or `risk` (a stored risk row). */
  source?: string;
}

export interface DelayPrediction {
  projectId: string;
  projectName: string | null;
  modelVersion: string;
  generatedAt: string;
  /** 0-100, capped at 98 and floored at 0. Always a number. */
  delayProbability: number;
  verdict: string;
  /** `YYYY-MM-DD`, or null — never pass straight to `new Date()`. */
  predictedFinishDate: string | null;
  targetDate: string | null;
  remainingWorkingDays: number | null;
  /** 0-100. */
  confidence: number;
  /** `FORECAST_DATA_QUALITY` (modelled) or `RISK_LEVEL_FALLBACK` (estimated). */
  confidenceBasis: string;
  /** 0-1, or null when there is no representative delivery history. */
  onTimeProbability: number | null;
  riskLevel: string;
  drivers: Record<string, DelayDriver>;
  sensitivity: Record<string, DelaySensitivity>;
  featureImportances: DelayFeatureImportance[];
  recommendations: string[];
  riskCounts: Record<string, number>;
  reasons: string[];
}

export interface DelaySimulationContribution {
  /** snake_case driver key, e.g. `pr_review_latency_hours`. */
  key: string;
  /** Human label from the backend, e.g. "PR review latency". */
  label?: string;
  value: number;
  baseline: number | null;
  /** Signed points this driver contributed to the scenario. */
  points: number;
  direction: string;
  basis: string;
}

export interface DelaySimulation {
  baseline: { delayProbability: number; predictedFinishDate: string | null; confidence: number };
  scenario: {
    delayProbability: number;
    deltaPoints: number;
    predictedFinishDate: string | null;
    shiftedWorkingDays: number | null;
    verdict: string;
  };
  /** Prefer these over `featureImportances` once a scenario has been run. */
  contributions: DelaySimulationContribution[];
}

/** Deterministic delay baseline for the selected project. Null only on failure. */
export async function getDelayPrediction(projectId: string): Promise<DelayPrediction | null> {
  return safeRead(
    async () => {
      const res = await http.get(`/projects/${projectId}/ai/delay-prediction`);
      return fromApi(res.data) as DelayPrediction;
    },
    null,
    'risk.delayPrediction',
  );
}

/** Any subset of the four drivers is allowed; omitted ones keep their baseline. */
export async function simulateDelay(
  projectId: string,
  drivers: Partial<Record<DelayDriverKey, number>>,
): Promise<DelaySimulation> {
  const res = await http.post(
    `/projects/${projectId}/ai/delay-prediction/simulate`,
    toApi(drivers as Record<string, unknown>),
  );
  return fromApi(res.data) as DelaySimulation;
}
