'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, Play, Target, Sparkles, Cpu, Hand } from 'lucide-react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { Collapsible } from '@shared/components/Collapsible';
import { DeadlinePredictionPanel } from '@pages/csr-pages/DeadlinePredictionPanel';
import {
  CompletionForecast,
  AIPrediction,
  RiskLevel,
  RiskAnalysisResult,
  RiskListResult,
  RiskRow,
} from '@shared/models';
import {
  analyzeProjectRisks,
  listProjectRisks,
  getCompletionForecast,
  getRiskPrediction,
} from '@core/services';

const LEVELS: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const LEVEL_META: Record<
  RiskLevel,
  { pill: string; banner: string; dot: string; label: string }
> = {
  CRITICAL: {
    pill: 'bg-rose-200 text-rose-900 border-rose-400',
    banner: 'bg-rose-600 text-white border-rose-700',
    dot: 'bg-rose-600',
    label: 'Critical',
  },
  HIGH: {
    pill: 'bg-orange-100 text-orange-800 border-orange-300',
    banner: 'bg-orange-500 text-white border-orange-600',
    dot: 'bg-orange-500',
    label: 'High',
  },
  MEDIUM: {
    pill: 'bg-amber-100 text-amber-800 border-amber-300',
    banner: 'bg-amber-300 text-slate-900 border-amber-500',
    dot: 'bg-amber-400',
    label: 'Medium',
  },
  LOW: {
    pill: 'bg-slate-100 text-slate-700 border-slate-300',
    banner: 'bg-slate-200 text-slate-800 border-slate-300',
    dot: 'bg-slate-400',
    label: 'Low',
  },
};

const sourceTag = (source?: RiskRow['source']) =>
  source === 'deterministic'
    ? { label: 'Auto', Icon: Cpu }
    : source === 'ai'
      ? { label: 'AI', Icon: Sparkles }
      : { label: 'Manual', Icon: Hand };

function relTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const isValidDate = (v?: string | null): boolean =>
  !!v && !Number.isNaN(new Date(v).getTime());
const fmtDate = (v?: string | null): string =>
  isValidDate(v) ? new Date(v as string).toLocaleDateString() : '—';

function deriveOverall(counts?: Partial<Record<RiskLevel, number>>): RiskLevel {
  if (!counts) return 'LOW';
  return LEVELS.find((l) => (counts[l] || 0) > 0) ?? 'LOW';
}

export const RiskAnalysis: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [list, setList] = useState<RiskListResult | null>(null);
  const [runResult, setRunResult] = useState<RiskAnalysisResult | null>(null);
  const [level, setLevel] = useState<RiskLevel | 'ALL'>('ALL');
  const [running, setRunning] = useState(false);

  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [forecast, setForecast] = useState<CompletionForecast | null>(null);

  // Predictions load once per project.
  useEffect(() => {
    let alive = true;
    setRunResult(null);
    (async () => {
      const [p, f] = await Promise.all([
        getRiskPrediction(projectId),
        getCompletionForecast(projectId),
      ]);
      if (!alive) return;
      setPrediction(p);
      setForecast(f);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Risk rows reload whenever the level filter changes.
  useEffect(() => {
    let alive = true;
    setList(null);
    listProjectRisks(projectId, level === 'ALL' ? undefined : level).then((r) => {
      if (alive) setList(r);
    });
    return () => {
      alive = false;
    };
  }, [projectId, level]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await analyzeProjectRisks(projectId);
      setRunResult(res);
      const refreshed = await listProjectRisks(projectId, level === 'ALL' ? undefined : level);
      setList(refreshed);
      onToast(
        `Risk analysis complete — ${res.overallRiskLevel}` +
          (res.aiUsed ? '' : ' (rules only)'),
      );
    } catch (err: any) {
      onToast(err?.msg || err?.message || 'Risk analysis unavailable');
    } finally {
      setRunning(false);
    }
  };

  const counts = runResult?.counts ?? list?.counts ?? {};
  const overall = runResult?.overallRiskLevel ?? deriveOverall(counts);
  const rows = list?.rows ?? [];

  // The forecast/prediction rows are absent until a project has synced history
  // and a target date — render "not enough data" rather than Invalid Date / 0%.
  const hasForecast = isValidDate(forecast?.p50);
  const hasPrediction = !!prediction && isValidDate(prediction.predictedFinishDate);

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4" />
          <span>Risk &amp; Prediction</span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{running ? 'Scoring schedule, velocity, scope, quality…' : 'Analyze risks'}</span>
        </button>
      </div>

      <Collapsible title="Risk analysis" defaultOpen>
        {/* overall banner + counts */}
        <div className={`px-4 py-3 border flex flex-wrap items-center gap-x-4 gap-y-2 ${LEVEL_META[overall].banner}`}>
          <span className="text-xs font-black uppercase tracking-widest">
            Overall risk: {LEVEL_META[overall].label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <span
                key={l}
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border bg-white/80 ${LEVEL_META[l].pill}`}
              >
                {LEVEL_META[l].label} {counts[l] ?? 0}
              </span>
            ))}
          </div>
          {runResult && (
            <span className="text-[10px] font-mono uppercase tracking-wider ml-auto opacity-90">
              Last analyzed {relTime(runResult.generatedAt)} · {runResult.aiUsed ? 'AI + rules' : 'rules only'}
            </span>
          )}
        </div>

        {runResult && !runResult.aiUsed && (
          <p className="mt-2 text-[10px] font-mono text-amber-700 uppercase tracking-wider">
            AI pass unavailable — showing rule-based risks only.
          </p>
        )}

        {/* level filter */}
        <div className="mt-3 flex flex-wrap gap-1">
          {(['ALL', ...LEVELS] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                level === l
                  ? 'bg-slate-900 text-white border-black'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {l === 'ALL' ? 'All' : LEVEL_META[l].label}
            </button>
          ))}
        </div>

        {/* rows */}
        <div className="mt-3 space-y-2">
          {list === null ? (
            <div className="flex items-center justify-center py-8 text-slate-500 text-xs font-mono uppercase tracking-widest">
              <ThemedLoader label="Loading risks" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 font-mono py-8 text-center uppercase tracking-wider">
              {level === 'ALL'
                ? 'No risks recorded — run an analysis to generate them.'
                : `No ${LEVEL_META[level as RiskLevel].label.toLowerCase()} risks.`}
            </p>
          ) : (
            rows.map((r) => {
              const tag = sourceTag(r.source);
              return (
                <div key={r.id} className="p-3.5 bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-slate-900 leading-snug">{r.summary}</p>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${LEVEL_META[r.riskLevel].pill}`}
                      >
                        {LEVEL_META[r.riskLevel].label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase text-slate-400">
                        <tag.Icon className="w-3 h-3" />
                        {tag.label}
                      </span>
                    </div>
                  </div>

                  {r.factors?.length > 0 && (
                    <ul className="space-y-0.5">
                      {r.factors.map((f, i) => (
                        <li key={i} className="text-[11px] font-mono text-slate-600 flex gap-1.5">
                          <span className="text-slate-400">–</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {r.mitigation && (
                    <div className="text-[11px] font-mono text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5">
                      <span className="font-bold uppercase tracking-wider text-[9px] text-indigo-500 block">
                        Mitigation
                      </span>
                      {r.mitigation}
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    {r.riskKey} · confidence {Math.round((r.confidenceScore ?? 0) * 100)}%
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Collapsible>

      {/* Predictions */}
      <Collapsible title="Completion & deadline predictions" bodyClassName="">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3 flex items-center">
            <Target className="w-4 h-4 text-indigo-600 mr-2" /> Completion forecast
          </h3>
          {!hasForecast && !hasPrediction ? (
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
              Not enough data to forecast — sync sprints &amp; work items and set a target date.
            </p>
          ) : (
            <>
              {hasForecast && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['p50', 'p80', 'p95'] as const).map((p) => (
                    <div key={p} className="p-2.5 bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400">{p}</span>
                      <div className="text-xs font-black text-slate-900 mt-1">
                        {fmtDate(forecast?.[p])}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {hasPrediction && (
                <div className="text-[11px] font-mono text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>AI predicted finish</span>
                    <span className="font-bold text-slate-900">
                      {fmtDate(prediction?.predictedFinishDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence</span>
                    <span className="font-bold text-slate-900">{prediction?.confidence ?? 0}%</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          <DeadlinePredictionPanel projectId={projectId} onToast={onToast} />
        </div>
      </div>
      </Collapsible>
    </div>
  );
};
