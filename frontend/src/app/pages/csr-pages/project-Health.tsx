'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GaugeCircle, Info, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { ProjectAnalytics } from '@pages/common/ProjectAnalytics';
import { RiskAnalysis } from '@pages/csr-pages/RiskAnalysis';
import { Collapsible } from '@shared/components/Collapsible';
import {
  AiHealthAssessment,
  PortfolioCompletionForecast,
  PortfolioProjectHealth,
  RulesHealth,
  RulesHealthSection,
  getPortfolioCompletionForecast,
  getPortfolioProjectHealth,
  getRulesHealth,
  refreshAiAssessment,
} from '@core/services';

interface HealthProps {
  projectId: string;
  organizationId?: string;
  onToast: (m: string) => void;
}

/**
 * App renders this component keyed by project, so every state below belongs to
 * the project the request started from — a result can never land on another one.
 */
type HealthAssessmentState =
  | { phase: 'idle' }
  | { phase: 'assessing'; startedAt: string }
  | { phase: 'success'; assessedAt: string; confidence: number }
  | { phase: 'error'; message: string; retryable: boolean };

/**
 * Health — the core intelligence page: is the project going in the right
 * direction to meet the deadline? Merges the former Analytics & Health and
 * Risk & Prediction tabs (Simplified Frontend Plan §10–11).
 */
export const Health: React.FC<HealthProps> = ({ projectId, organizationId, onToast }) => {
  const [health, setHealth] = useState<PortfolioProjectHealth | null>(null);
  const [forecast, setForecast] = useState<PortfolioCompletionForecast | null>(null);
  // Calculated from delivery data on request — independent of the AI assessment.
  const [rulesHealth, setRulesHealth] = useState<RulesHealth | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [assessment, setAssessment] = useState<AiHealthAssessment | null>(null);
  const [state, setState] = useState<HealthAssessmentState>({ phase: 'idle' });
  const [syncFirst, setSyncFirst] = useState(false);
  // Bumped after an assessment so the analytics and risk panels refetch.
  const [refreshKey, setRefreshKey] = useState(0);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const persistedAssessment = (value: PortfolioProjectHealth | null): AiHealthAssessment | null =>
    value?.assessment ? {
      health: value.assessment.health,
      quality: value.assessment.quality,
      confidencePercent: value.assessment.confidencePercent,
      summary: value.assessment.summary,
      limitations: value.assessment.limitations,
      evidence: value.assessment.evidence,
      sources: value.assessment.sources,
      assessedAt: value.assessment.assessedAt || '',
    } : null;

  useEffect(() => {
    mounted.current = true;
    void Promise.allSettled([
      getPortfolioProjectHealth(projectId),
      getPortfolioCompletionForecast(projectId),
      getRulesHealth(projectId),
    ]).then(([healthResult, forecastResult, rulesResult]) => {
      if (!mounted.current) return;
      // Never overwrite fresher data from an assessment that finished first.
      if (healthResult.status === 'fulfilled') {
        setHealth((current) => current ?? healthResult.value);
        setAssessment((current) => current ?? persistedAssessment(healthResult.value));
      }
      if (forecastResult.status === 'fulfilled') setForecast((current) => current ?? forecastResult.value);
      // The rules score is never returned by the assessment, so it just lands.
      if (rulesResult.status === 'fulfilled') setRulesHealth(rulesResult.value);
      setLoaded(true);
    });
    return () => {
      mounted.current = false;
    };
  }, [projectId]);

  const assessing = state.phase === 'assessing';
  const accessDenied = state.phase === 'error' && !state.retryable;

  /** Re-read the persisted records instead of relying only on the long-running
   * POST response. The backend saves health before risk/forecast/context work,
   * so useful data may exist even when a later pipeline stage or client timeout
   * makes the combined request report an error. */
  const reloadPersistedHealth = async () => {
    const [healthResult, forecastResult, rulesResult] = await Promise.allSettled([
      getPortfolioProjectHealth(projectId),
      getPortfolioCompletionForecast(projectId),
      getRulesHealth(projectId),
    ]);
    if (!mounted.current) return false;
    let recovered = false;
    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value);
      setAssessment(persistedAssessment(healthResult.value));
      recovered = true;
    }
    if (forecastResult.status === 'fulfilled') setForecast(forecastResult.value);
    if (rulesResult.status === 'fulfilled') setRulesHealth(rulesResult.value);
    if (recovered) {
      setLoaded(true);
      setRefreshKey((key) => key + 1);
    }
    return recovered;
  };

  const runAssessment = async () => {
    if (inFlight.current || accessDenied) return;
    inFlight.current = true;
    setState({ phase: 'assessing', startedAt: new Date().toISOString() });
    try {
      const result = await refreshAiAssessment(projectId, { sync: syncFirst });
      if (!mounted.current) return;
      const responseProjectId = String(result.health?.project?.id || result.projectId || '');
      if (responseProjectId && responseProjectId !== String(projectId)) {
        throw new Error(
          `Assessment returned health for a different project (${responseProjectId}). Requested ${projectId}.`,
        );
      }
      setAssessment(result.assessment);
      setHealth(result.health);
      setForecast(result.completionForecast);
      setLoaded(true);
      // Confirm what was actually committed and refresh trend/risk panels from
      // the database-backed GET routes.
      await reloadPersistedHealth();
      setState({
        phase: 'success',
        assessedAt: result.assessment.assessedAt,
        confidence: result.assessment.confidencePercent,
      });
      onToast('AI health assessment updated');
    } catch (err: any) {
      if (!mounted.current) return;
      const message = err?.msg || err?.message || '';
      const recovered = await reloadPersistedHealth();
      if (!mounted.current) return;
      if (err?.status === 403) {
        setState({ phase: 'error', message: "You don't have access to assess this project", retryable: false });
      } else if (err?.status == null && /timeout|network/i.test(message)) {
        setState({
          phase: 'error',
          message: recovered
            ? 'The assessment response timed out, but the saved health data was reloaded.'
            : 'Assessment is taking longer than expected. Refresh the Health section in a minute.',
          retryable: true,
        });
      } else {
        setState({
          phase: 'error',
          message: recovered
            ? `${message || 'A later assessment step failed.'} Saved health data was reloaded.`
            : message || 'AI assessment failed.',
          retryable: true,
        });
      }
    } finally {
      inFlight.current = false;
    }
  };

  const dimensionValue = (metric: string) =>
    health?.dimensions.find((dimension) => dimension.metric === metric)?.value ?? null;
  const healthScore = assessment ? assessment.health : dimensionValue('health');
  const qualityScore = assessment ? assessment.quality : dimensionValue('quality');
  const noScore = healthScore == null && qualityScore == null
    && (health == null || health.overall.status === 'unknown');
  const lowConfidence = assessment != null && assessment.confidencePercent < 50;
  const showVelocityHint = state.phase === 'success'
    && [dimensionValue('velocity'), dimensionValue('progress')].some((value) => value == null || value === 0);

  const announcement = assessing
    ? 'Assessing project health'
    : state.phase === 'success'
      ? 'AI health assessment updated'
      : state.phase === 'error'
        ? state.message
        : '';

  const runButton = (
    <button
      type="button"
      onClick={() => void runAssessment()}
      disabled={assessing || accessDenied}
      aria-busy={assessing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[11px] font-black uppercase tracking-widest border border-violet-700 disabled:opacity-60"
    >
      {assessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      <span>{assessing ? 'Assessing project health…' : 'Run AI assessment'}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <GaugeCircle className="w-4 h-4" />
          <span>Project Health &amp; Deadline</span>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          {runButton}
          <label className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
            <input
              type="checkbox"
              checked={syncFirst}
              onChange={(e) => setSyncFirst(e.target.checked)}
              disabled={assessing}
            />
            Sync sources first
          </label>
          {assessment?.assessedAt && (
            <span className="text-[10px] font-mono text-slate-500">Last assessed {timeAgo(assessment.assessedAt)}</span>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {state.phase === 'error' && (
        <div className="p-4 bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs font-mono text-rose-700">
          <span>{state.message}</span>
          {state.retryable && (
            <button
              type="button"
              onClick={() => void runAssessment()}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-800"
            >
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      )}

      <div className={`space-y-6 transition-opacity ${assessing ? 'opacity-60' : ''}`}>
        <Collapsible title="AI health assessment" defaultOpen>
          {!loaded ? (
            <p className="inline-flex items-center text-[10px] font-bold uppercase text-slate-500">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading health
            </p>
          ) : noScore && !assessment ? (
            // No AI score yet, but the rules score needs no AI — still show it.
            <div className="space-y-4">
              <div className="p-4 bg-white border border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs font-mono text-slate-600">No AI health score yet.</p>
                {runButton}
              </div>
              {rulesHealth && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <RulesHealthTile rules={rulesHealth} />
                    <ForecastTile forecast={forecast} />
                  </div>
                  <RulesHealthDetail rules={rulesHealth} />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ScoreTile label="Health" value={healthScore} lowConfidence={lowConfidence} />
                <ScoreTile label="Quality" value={qualityScore} lowConfidence={lowConfidence} />
                <RulesHealthTile rules={rulesHealth} />
                <ForecastTile forecast={forecast} />
              </div>
              {rulesHealth && <RulesHealthDetail rules={rulesHealth} />}
              {assessment && (
                <div className="space-y-2">
                  {assessment.summary && <p className="text-xs text-slate-800">{assessment.summary}</p>}
                  <p className="text-[10px] font-mono text-slate-500">
                    Confidence {Math.round(assessment.confidencePercent)}%
                  </p>
                  {assessment.limitations.length > 0 && (
                    <ul className="list-disc pl-5 text-[11px] text-slate-700 space-y-0.5">
                      {assessment.limitations.map((limitation, index) => (
                        <li key={index}>{limitation}</li>
                      ))}
                    </ul>
                  )}
                  {assessment.evidence.length > 0 && (
                    <details className="text-[11px] text-slate-700">
                      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Evidence ({assessment.evidence.length})
                      </summary>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 font-mono break-words">
                        {assessment.evidence.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              {showVelocityHint && (
                <p className="text-[10px] font-mono text-amber-700">
                  Velocity and progress need completed Taiga sprints and done work items.
                </p>
              )}
            </div>
          )}
        </Collapsible>

        <Collapsible title="Health components & trend" defaultOpen>
          <ProjectAnalytics
            key={`analytics-${refreshKey}`}
            projectId={projectId}
            organizationId={organizationId}
            onToast={onToast}
          />
        </Collapsible>

        <Collapsible title="Risk & deadline prediction">
          <RiskAnalysis key={`risk-${refreshKey}`} projectId={projectId} onToast={onToast} />
        </Collapsible>
      </div>
    </div>
  );
};

const scoreBand = (value: number) =>
  value >= 80
    ? { text: 'text-emerald-700', label: 'Good' }
    : value >= 60
      ? { text: 'text-amber-700', label: 'Fair' }
      : { text: 'text-rose-700', label: 'At risk' };

const ScoreTile: React.FC<{ label: string; value: number | null; lowConfidence: boolean }> = ({
  label,
  value,
  lowConfidence,
}) => (
  <div className="p-4 bg-white border border-slate-300">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {value != null && lowConfidence && (
        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
          Low confidence
        </span>
      )}
    </div>
    {value != null ? (
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-black ${scoreBand(value).text}`}>{Math.round(value)}</span>
        <span className={`text-[10px] font-bold uppercase ${scoreBand(value).text}`}>{scoreBand(value).label}</span>
      </div>
    ) : (
      <p className="mt-2 text-sm font-bold text-slate-400">Not enough evidence</p>
    )}
  </div>
);

const ForecastTile: React.FC<{ forecast: PortfolioCompletionForecast | null }> = ({ forecast }) => {
  const f = forecast?.forecast;
  const value = f?.status === 'complete'
    ? 'Complete'
    : f?.p50
      ? new Date(f.p50).toLocaleDateString()
      : 'Not enough data';
  const detail = f?.onTimeProbability != null
    ? `${Math.round(f.onTimeProbability * 100)}% on time`
    : f?.status === 'insufficient_data'
      ? 'Needs completed Taiga sprints'
      : '';
  return (
    <div className="p-4 bg-white border border-slate-300">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Predicted completion</span>
      <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-mono text-slate-500">
        {detail}
        {forecast?.confidence ? `${detail ? ' · ' : ''}${forecast.confidence} confidence` : ''}
      </p>
    </div>
  );
};

const RULES_BAND_TEXT: Record<string, { text: string; label: string }> = {
  HIGH: { text: 'text-emerald-700', label: 'High' },
  AVERAGE: { text: 'text-amber-700', label: 'Average' },
  LOW: { text: 'text-rose-700', label: 'Low' },
  'N/A': { text: 'text-slate-400', label: '—' },
};
const bandStyle = (band: string) => RULES_BAND_TEXT[band] ?? RULES_BAND_TEXT['N/A'];

/** Ordered by weight at render time; the labels explain what each section measures. */
const RULES_SECTION_LABELS: Record<string, { label: string; measures: string }> = {
  feature: { label: 'Feature delivery vs plan', measures: 'Work done vs the share the plan had due today' },
  tasks: { label: 'Task resolution', measures: 'Items due today (own due date, else sprint end) that are closed' },
  sprint: { label: 'Sprint completion', measures: 'Items closed by their sprint’s end date' },
  efficiency: { label: 'Work efficiency', measures: 'Actual vs estimated hours (not tracked)' },
  evidence: { label: 'Code activity', measures: 'Working days with commits, last 10 working days' },
  deadline: { label: 'Deadline feasibility', measures: 'Simulated on-time probability' },
};

const RULES_REASON_TEXT: Record<string, string> = {
  NOT_DUE: 'Nothing due yet',
  NO_PLAN: 'No sprint plan',
  PLAN_NOT_ACCEPTED: 'Plan not accepted (using latest draft)',
  NO_COMMITTED_SCOPE: 'No work items',
  NO_DUE_DATES: 'No due dates or sprints on items',
  NO_SPRINT_COMMITMENT: 'Ended sprints have no items or points',
  MISSING_ACTUAL_HOURS: 'Actual hours not tracked',
  NO_REPOSITORY_DATA: 'No repository connected',
  NO_TARGET_DATE: 'No deadline set',
  NO_REPRESENTATIVE_HISTORY: 'Under 8 weeks of delivery history',
  ZERO_THROUGHPUT: 'Nothing closed in the last 20 working days',
};

/** `reasons` arrive as SECTION:CODE; unknown codes are shown verbatim. */
const reasonText = (reason: string) => {
  const code = reason.includes(':') ? reason.slice(reason.indexOf(':') + 1) : reason;
  return RULES_REASON_TEXT[code] ?? code;
};

const RULES_FLAG_TEXT: Record<string, { label: string; danger: boolean }> = {
  PREDICTED_LATE: { label: 'Predicted late', danger: true },
  HIGH_DEADLINE_RISK: { label: 'Deadline at risk', danger: false },
  OVERDUE: { label: 'Overdue', danger: true },
  ZERO_THROUGHPUT: { label: 'No recent closures', danger: false },
};

const sectionCounts = (key: string, section: RulesHealthSection) => {
  const { numerator, denominator } = section;
  if (numerator != null && denominator != null) {
    if (key === 'tasks') return `${numerator} / ${denominator} resolved`;
    if (key === 'evidence') return `${numerator} / ${denominator} days with commits`;
    return `${numerator} / ${denominator}`;
  }
  if (denominator != null) {
    if (key === 'sprint') return `${denominator} ended sprint${denominator === 1 ? '' : 's'}`;
    return `${denominator}`;
  }
  return '';
};

/**
 * Rule-based health. `value` is the only official score; `provisionalScore` is a
 * weaker signal over partial coverage and is always badged as such.
 */
const RulesHealthTile: React.FC<{ rules: RulesHealth | null }> = ({ rules }) => {
  const provisional = rules != null && rules.value == null && rules.provisionalScore != null;
  const band = bandStyle(provisional ? rules!.provisionalBand : rules?.band ?? 'N/A');
  return (
    <div className="p-4 bg-white border border-slate-300">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rule-based health</span>
        {provisional ? (
          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            Provisional
          </span>
        ) : (
          rules && (
            <span
              aria-label="How this score is calculated"
              title={`Calculated from delivery data using the scoring rules, version ${rules.rulesVersion}. No AI.`}
              className="shrink-0 cursor-help"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </span>
          )
        )}
      </div>
      {rules?.value != null ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-3xl font-black ${band.text}`}>{Math.round(rules.value)}</span>
          <span className={`text-[10px] font-bold uppercase ${band.text}`}>{band.label}</span>
        </div>
      ) : provisional ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${band.text}`}>{rules!.provisionalScore!.toFixed(1)}</span>
            <span className={`text-[10px] font-bold uppercase ${band.text}`}>{band.label}</span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            Based on {Math.round(rules!.coverageWeight * 100)}% of the scoring weight
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm font-bold text-slate-400">Not enough evidence</p>
      )}
    </div>
  );
};

const RulesHealthDetail: React.FC<{ rules: RulesHealth }> = ({ rules }) => {
  const sections = Object.entries(rules.sections).sort((a, b) => b[1].weight - a[1].weight);
  // Efficiency is unscored on every project, so it only clutters the summary.
  const headlineReasons = rules.reasons.filter((r) => r !== 'EFFICIENCY:MISSING_ACTUAL_HOURS');

  return (
    <div className="space-y-2">
      {rules.deliveryFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rules.deliveryFlags.map((flag) => {
            const meta = RULES_FLAG_TEXT[flag];
            const danger = meta?.danger ?? false;
            return (
              <span
                key={flag}
                className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                  danger
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                {meta?.label ?? flag}
              </span>
            );
          })}
        </div>
      )}

      {rules.value == null && headlineReasons.length > 0 && (
        <p className="text-[10px] font-mono text-slate-500">
          No final value: {headlineReasons.map(reasonText).join(' · ')}
        </p>
      )}

      <details className="text-[11px] text-slate-700">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
          Rule-based breakdown ({sections.length})
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
          <tbody>
            {sections.map(([key, section]) => {
              const meta = RULES_SECTION_LABELS[key];
              const counts = sectionCounts(key, section);
              return (
                <tr key={key} className="border-t border-slate-200 align-top">
                  <td className="py-1.5 pr-3">
                    <span className="font-bold text-slate-800">{meta?.label ?? key}</span>
                    {meta && <span className="block text-[10px] text-slate-500">{meta.measures}</span>}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                    {Math.round(section.weight * 100)}%
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-800 whitespace-nowrap">
                    {section.score != null ? section.score.toFixed(1) : '—'}
                  </td>
                  <td className="py-1.5 font-mono text-[10px] text-slate-500">
                    {counts}
                    {section.score == null && section.reason && (
                      <span className="block text-slate-400">{reasonText(section.reason)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] font-mono text-slate-400">
          As of {rules.asOf} · rules {rules.rulesVersion} · needs {Math.round(rules.minCoverage * 100)}% coverage
          (now {Math.round(rules.coverageWeight * 100)}%)
        </p>
      </details>
    </div>
  );
};

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};
