'use client';

import React, { useState } from 'react';
import { CalendarClock, Loader2, Play } from 'lucide-react';
import { DeadlinePrediction, predictDeadline } from '@core/services';

/** "NO_REPRESENTATIVE_HISTORY" / "estimateCoverage" → "No representative history" / "Estimate coverage". */
const humanize = (code?: string | null) =>
  code
    ? code
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase())
    : '—';

const fmtDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

/** Accepts a 0–1 fraction or a 0–100 value. */
const asPercent = (value: number | null | undefined) => (value == null ? null : value <= 1 ? value * 100 : value);

const RISK_TONE: Record<string, string> = {
  CRITICAL: 'bg-rose-600 text-white border-rose-700',
  HIGH: 'bg-orange-500 text-white border-orange-600',
  MEDIUM: 'bg-amber-300 text-slate-900 border-amber-500',
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export const DeadlinePredictionPanel: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [result, setResult] = useState<DeadlinePrediction | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      setResult(await predictDeadline(projectId));
      setError(null);
      onToast('Deadline prediction updated');
    } catch (err: any) {
      const message = err?.msg || err?.message || 'Deadline prediction unavailable';
      setError(message);
      onToast(message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-5 bg-white border border-slate-300 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
          <CalendarClock className="w-4 h-4 text-indigo-600 mr-2" /> Deadline probability
        </h3>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          aria-busy={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Predicting…' : result ? 'Re-run prediction' : 'Run prediction'}
        </button>
      </div>

      {error && (
        <p className="p-3 bg-rose-50 border border-rose-200 text-xs font-mono text-rose-700">{error}</p>
      )}

      {!result ? (
        !error && (
          <p className="text-[11px] font-mono text-slate-500 py-4">
            Compares the forecast finish date with the latest plan deadline, using Taiga delivery history. It does not sync
            sources or call AI.
          </p>
        )
      ) : (
        <DeadlineResult result={result} />
      )}
    </div>
  );
};

const DeadlineResult: React.FC<{ result: DeadlinePrediction }> = ({ result }) => {
  // The route may return a slim payload (percentage and/or date); show a compact result then.
  if (!result.ruleForecast && !result.dataQuality && !result.summary) {
    const percent = result.deadlineMeetPercentage;
    const tone = percent == null
      ? { text: 'text-slate-400', bar: 'bg-slate-300', label: '' }
      : percent >= 70
        ? { text: 'text-emerald-600', bar: 'bg-emerald-600', label: 'Likely to meet the deadline' }
        : percent >= 40
          ? { text: 'text-orange-600', bar: 'bg-orange-500', label: 'At risk of missing the deadline' }
          : { text: 'text-rose-600', bar: 'bg-rose-600', label: 'Unlikely to meet the deadline' };
    return (
      <div>
        <div className="p-4 bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chance of meeting the deadline</span>
          <div className={`mt-1 text-3xl font-black ${tone.text}`}>{percent == null ? '—' : `${Math.round(percent)}%`}</div>
          <div
            className="w-full bg-slate-200 h-2 mt-1"
            role="meter"
            aria-label="Chance of meeting the deadline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent == null ? undefined : Math.round(percent)}
          >
            <div className={`h-full ${tone.bar}`} style={{ width: `${percent ?? 0}%` }} />
          </div>
          <p className={`text-[10px] font-mono mt-1 ${percent == null ? 'text-slate-500' : tone.text}`}>
            {percent == null ? 'Not enough delivery history to estimate.' : tone.label}
          </p>
        </div>
      </div>
    );
  }

  const rule = result.ruleForecast;
  const det = rule?.deterministic;
  const scope = rule?.scope;
  const onTime = asPercent(result.onTimeProbability ?? rule?.probability?.onTime);
  const probabilityReason = rule?.probability?.reason
    ?? (typeof result.explanation?.missingData?.[0] === 'string' ? (result.explanation.missingData[0] as string) : null);
  const slack = det?.slackWorkingDays ?? null;
  const donePercent = scope?.totalItems ? (scope.acceptedItems / scope.totalItems) * 100 : null;
  const capacityPercent = det?.capacityRatio == null ? null : det.capacityRatio * 100;
  const aiUnavailable = (result.explanation?.validation || '').startsWith('AI_UNAVAILABLE');
  const risk = String(result.riskLevel || '').toUpperCase();
  const quality = result.dataQuality;
  const projectState = String(rule?.status || '').toLowerCase();
  const boundaryMessage = projectState === 'complete'
    ? 'This project is already completed. All counted work items are closed, so no completion-date prediction is needed.'
    : projectState === 'not_started'
      ? 'This project has not started yet. A completion date will be predicted after work begins.'
      : null;

  return (
    <div className="space-y-4">
      {boundaryMessage && (
        <div className={`p-4 border ${projectState === 'complete' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
          <div className="text-[10px] font-black uppercase tracking-widest">
            {projectState === 'complete' ? 'Already completed' : 'Not started'}
          </div>
          <p className="mt-1 text-xs font-medium">{boundaryMessage}</p>
        </div>
      )}

      {/* Risk + flags */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${RISK_TONE[risk] ?? 'bg-slate-100 text-slate-700 border-slate-300'}`}>
          {risk || 'Unknown'} risk
        </span>
        {result.flags.map((flag) => (
          <span key={flag} className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200">
            {humanize(flag)}
          </span>
        ))}
        <span className="ml-auto text-[10px] font-mono text-slate-400">
          {rule?.asOf ? `As of ${rule.asOf}` : fmtDate(result.generatedAt)}
        </span>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">On-time probability</span>
          {onTime != null ? (
            <>
              <div className={`mt-1 text-3xl font-black ${onTime >= 70 ? 'text-emerald-600' : onTime >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(onTime)}%
              </div>
              <div className="w-full bg-slate-200 h-2 mt-1">
                <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, onTime)}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-black text-slate-400">Unavailable</div>
              {probabilityReason && <p className="text-[10px] font-mono text-slate-500">{humanize(probabilityReason)}</p>}
            </>
          )}
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Schedule slack</span>
          <div className={`mt-1 text-3xl font-black ${slack == null ? 'text-slate-400' : slack < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {slack == null ? '—' : `${slack > 0 ? '+' : ''}${slack}`}
          </div>
          <p className="text-[10px] font-mono text-slate-500">
            {slack == null ? 'Not enough data' : slack < 0 ? 'working days behind the target' : 'working days ahead of the target'}
          </p>
        </div>
      </div>

      {/* Dates and effort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Metric
          label="Predicted finish"
          value={projectState === 'complete' ? 'Completed' : projectState === 'not_started' ? 'Not available yet' : fmtDate(det?.predictedFinishDate ?? result.predictedDate)}
          hint={det?.accuracyLabel ? humanize(det.accuracyLabel) : undefined}
        />
        <Metric
          label="Target"
          value={fmtDate(det?.targetDate ?? result.targetDate)}
          hint={rule?.targetSource ? humanize(rule.targetSource) : undefined}
        />
        <Metric label="Working days needed" value={det?.predictedRemainingWorkingDays == null ? '—' : `${det.predictedRemainingWorkingDays}`} />
        <Metric label="Working days available" value={det?.availableWorkingDays == null ? '—' : `${det.availableWorkingDays}`} />
      </div>

      {/* Velocity + scope */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 border border-slate-200 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Velocity</span>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Current / working day"
              value={result.velocity?.perWorkingDay == null ? '—' : `${result.velocity.perWorkingDay}`}
              hint={result.velocity ? `${result.velocity.acceptedInWindow} closed in ${result.velocity.windowWorkingDays} days` : undefined}
            />
            <Metric
              label="Required / working day"
              value={det?.requiredVelocityPerWorkingDay == null ? '—' : `${det.requiredVelocityPerWorkingDay}`}
            />
          </div>
          {capacityPercent != null && (
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-600">
                <span>Capacity vs required</span>
                <span className={capacityPercent >= 100 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {Math.round(capacityPercent)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 mt-1">
                <div
                  className={`h-full ${capacityPercent >= 100 ? 'bg-emerald-600' : 'bg-rose-600'}`}
                  style={{ width: `${Math.min(100, capacityPercent)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border border-slate-200 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scope</span>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Done" value={scope ? `${scope.acceptedItems}` : '—'} />
            <Metric label="Remaining" value={`${scope?.remainingItems ?? result.remainingItems ?? '—'}`} />
            <Metric label="Total" value={scope ? `${scope.totalItems}` : '—'} />
          </div>
          {donePercent != null && (
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-600">
                <span>{humanize(rule?.workUnit)}</span>
                <span className="font-bold text-slate-900">{Math.round(donePercent)}% done</span>
              </div>
              <div className="w-full bg-slate-200 h-2 mt-1">
                <div className="h-full bg-indigo-600" style={{ width: `${donePercent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data quality */}
      {quality && (
        <div className="p-3 border border-slate-200 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data quality</span>
            <span className="text-sm font-black text-slate-900">
              {quality.score == null ? '—' : `${quality.score}/100`}
            </span>
          </div>
          <ul className="space-y-1.5">
            {Object.entries(quality.components ?? {}).map(([key, component]) => {
              const value = asPercent(component.value);
              return (
                <li key={key}>
                  <div className="flex justify-between gap-3 text-[10px] font-mono text-slate-600">
                    <span>
                      {humanize(key)} <span className="text-slate-400">· weight {Math.round(component.weight * 100)}%</span>
                    </span>
                    <span className={value == null ? 'text-slate-400' : 'font-bold text-slate-900'}>
                      {value == null ? humanize(component.basis) : `${Math.round(value)}%`}
                    </span>
                  </div>
                  {value != null && (
                    <div className="w-full bg-slate-200 h-1.5 mt-0.5">
                      <div className="h-full bg-slate-700" style={{ width: `${Math.min(100, value)}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="space-y-1.5">
        {result.summary && <p className="text-xs text-slate-800 leading-relaxed">{result.summary}</p>}
        <p className="text-[10px] font-mono text-slate-500">
          {humanize(result.calibration)} · {rule?.modelVersion ?? 'rule-based'}
          {det?.dependencies ? ` · ${humanize(det.dependencies)}` : ''}
        </p>
        {aiUnavailable && (
          <p className="text-[10px] font-mono text-amber-700">AI explanation unavailable; showing the rule-based summary.</p>
        )}
      </div>

      {result.factors.length > 0 && (
        <details className="text-[11px] text-slate-700">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
            Factors ({result.factors.length})
          </summary>
          <ul className="mt-1 space-y-0.5 font-mono">
            {result.factors.map((factor, index) => (
              <li key={index}>– {factor}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="p-2.5 bg-slate-50 border border-slate-200 min-w-0">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className="text-xs font-black text-slate-900 mt-1 break-words">{value}</div>
    {hint && <div className="text-[9px] font-mono text-slate-500 mt-0.5">{hint}</div>}
  </div>
);
