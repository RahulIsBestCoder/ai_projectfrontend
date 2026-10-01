'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Brain, FileText, ListChecks, Loader2, ShieldAlert } from 'lucide-react';
import { Collapsible } from '@shared/components/Collapsible';
import {
  AiDashboardCard,
  PortfolioProjectCard,
  getAiDashboard,
  getPortfolioCompletionForecast,
  getPortfolioProjectHealth,
} from '@core/services';
import {
  ProjectOpenSnapshot,
  baseCard,
  countsText,
  hydrateCard,
  itemText,
  pctText,
  probabilityPercent,
} from '@core/services/portfolioCard';

interface ProjectDashboardSummaryProps {
  projectId: string;
  projectName?: string;
  projectDescription?: string;
  /** Card data handed over by Portfolio "Open"; shown immediately, then refreshed. */
  seed?: ProjectOpenSnapshot | null;
  onNavigateToReports: () => void;
}

/**
 * Overview's project dashboard: the Portfolio card's health/forecast plus the
 * full latest AI report for the selected project. Render keyed by project.
 */
export const ProjectDashboardSummary: React.FC<ProjectDashboardSummaryProps> = ({
  projectId,
  projectName,
  projectDescription,
  seed,
  onNavigateToReports,
}) => {
  const [card, setCard] = useState<PortfolioProjectCard | null>(seed?.card ?? null);
  const [ai, setAi] = useState<AiDashboardCard | null>(seed?.ai ?? null);
  const [refreshing, setRefreshing] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [healthResult, forecastResult, aiResult] = await Promise.allSettled([
        getPortfolioProjectHealth(projectId),
        getPortfolioCompletionForecast(projectId),
        getAiDashboard([projectId]),
      ]);
      if (!alive) return;
      const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
      const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : null;
      // Keep the handed-over card if both refreshes failed.
      if (health || forecast || !seed?.card) {
        const base = seed?.card ?? baseCard({
          id: projectId, organizationId: '', name: projectName || '', description: projectDescription || '', status: '',
        });
        setCard(hydrateCard(base, health, forecast));
      }
      if (aiResult.status === 'fulfilled') {
        setAi(aiResult.value.rows.find((row) => row.project.id === projectId) ?? null);
        setAiError(null);
      } else if (!seed?.ai) {
        const err: any = aiResult.reason;
        setAiError(err?.msg || err?.message || 'AI report data is unavailable.');
      }
      setRefreshing(false);
    })();
    return () => {
      alive = false;
    };
    // The component is keyed by project; the seed only initialises it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <Collapsible title="Project dashboard" defaultOpen subtitle={refreshing ? 'Refreshing…' : undefined} bodyClassName="">
      <div className="space-y-4">
        <DeliveryStrip card={card} />
        {ai?.implementation ? (
          <AiReportDetail ai={ai} />
        ) : (
          <div className="p-4 bg-white border border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-mono text-slate-600 inline-flex items-center">
              {refreshing && !ai ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading AI report…
                </>
              ) : aiError ? (
                <>
                  {aiError}
                  <span className="text-slate-400">
                    {' '}
                    This panel needs a live backend session — sign out and back in if it persists.
                  </span>
                </>
              ) : (
                'No AI report yet for this project. Generate one to see implementation, risk and narrative.'
              )}
            </p>
            {!refreshing && (
              <button
                type="button"
                onClick={onNavigateToReports}
                className="self-start sm:self-auto px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-widest border border-black"
              >
                Open Reports
              </button>
            )}
          </div>
        )}
      </div>
    </Collapsible>
  );
};

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const DeliveryStrip: React.FC<{ card: PortfolioProjectCard | null }> = ({ card }) => {
  if (!card) {
    return (
      <p className="p-4 bg-white border border-slate-300 inline-flex items-center text-[10px] font-bold uppercase text-slate-500">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading health and forecast
      </p>
    );
  }
  return (
    <div className="p-4 bg-white border border-slate-300">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <Metric label="Open risks" value={card.healthUnavailable ? '—' : String(card.openRisks)} />
        <Metric label="Delay" value={card.delayPercent == null ? '—' : `${card.delayPercent}%`} />
        <Metric
          label="Predicted completion"
          value={card.predictedCompletionDate
            ? fmtDate(card.predictedCompletionDate)
            : card.forecastStatus === 'insufficient_data' ? 'Needs a scored sprint' : '—'}
        />
        <Metric label="Remaining scope" value={card.remainingStoryPoints == null ? '—' : `${card.remainingStoryPoints} pts`} />
        <Metric label="Forecast confidence" value={card.forecastConfidence ?? '—'} />
      </div>
    </div>
  );
};

const AiReportDetail: React.FC<{ ai: AiDashboardCard }> = ({ ai }) => {
  const impl = ai.implementation!;
  const tasks = impl.tasks;
  const segments = [
    { key: 'completed', label: 'Completed', value: tasks.completed, cls: 'bg-emerald-600' },
    { key: 'inProgress', label: 'In progress', value: tasks.inProgress, cls: 'bg-indigo-600' },
    { key: 'blocked', label: 'Blocked', value: tasks.blocked, cls: 'bg-rose-600' },
    { key: 'notStarted', label: 'Not started', value: tasks.notStarted, cls: 'bg-slate-400' },
  ];
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  const attention = (ai.summary?.needsAttention ?? []).map(itemText).filter(Boolean);
  const recommendations = (ai.summary?.recommendations ?? []).map(itemText).filter(Boolean);
  const topRisks = (ai.risk?.top ?? [])
    .map((risk) => ({ text: itemText(risk), severity: String((risk as any)?.severity ?? '') }))
    .filter((risk) => risk.text);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase text-slate-500">
        <span className="inline-flex items-center gap-1 font-bold text-violet-800">
          <FileText className="w-3.5 h-3.5" /> From the latest AI report
        </span>
        <span className="inline-flex items-center gap-2">
          {ai.report.generatedAt && <span>Generated {new Date(ai.report.generatedAt).toLocaleString()}</span>}
          {ai.report.stale && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-bold">
              Stale · refresh report
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel icon={ListChecks} title="Implementation">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-violet-700">{pctText(impl.completePercent)}</span>
            <span className="text-[10px] font-mono text-slate-500">
              complete · {pctText(impl.remainingPercent)} remaining
            </span>
          </div>
          {segmentTotal > 0 && (
            <div
              className="flex h-2 w-full overflow-hidden bg-slate-200"
              role="img"
              aria-label={segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}
            >
              {segments.map((segment) => segment.value > 0 && (
                <div key={segment.key} className={segment.cls} style={{ width: `${(segment.value / segmentTotal) * 100}%` }} />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Metric label="Tasks" value={String(tasks.total)} />
            {segments.map((segment) => (
              <Metric key={segment.key} label={segment.label} value={String(segment.value)} />
            ))}
          </div>
          <p className="text-[10px] font-mono text-slate-600">Features: {countsText(impl.features)}</p>
          {impl.basis && <p className="text-[10px] font-mono text-slate-400">Basis: {impl.basis.replace(/_/g, ' ')}</p>}
        </Panel>

        <Panel icon={Activity} title="Health & velocity">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Metric label="Health status" value={ai.health?.status ?? '—'} />
            <Metric label="Health trend" value={ai.health?.trend ?? '—'} />
            <Metric label="Velocity" value={ai.velocity?.value == null ? '—' : String(ai.velocity.value)} />
            <Metric label="Previous velocity" value={ai.velocity?.previous == null ? '—' : String(ai.velocity.previous)} />
            <Metric label="Sprint completion" value={pctText(ai.velocity?.completionRate)} />
          </div>
          {ai.velocity?.sprintName && (
            <p className="text-[10px] font-mono text-slate-600">
              Sprint: {ai.velocity.sprintName} · velocity trend {ai.velocity.trend}
            </p>
          )}
        </Panel>

        <Panel icon={ShieldAlert} title="Risk & forecast">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Overall risk" value={ai.risk?.overall ?? '—'} />
            <Metric label="Deadline risk" value={ai.risk?.deadline ?? '—'} />
            <Metric label="On-time probability" value={pctText(probabilityPercent(ai.forecast?.deadlineProbability))} />
            <Metric label="Expected completion" value={fmtDate(ai.forecast?.expectedCompletionDate)} />
          </div>
          {topRisks.length > 0 && (
            <ul className="space-y-1.5">
              {topRisks.map((risk, index) => (
                <li key={index} className="text-[11px] text-slate-800 flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600 mt-1 shrink-0" />
                  <span>
                    {risk.text}
                    {risk.severity && <span className="ml-1 text-[9px] font-mono uppercase text-slate-500">({risk.severity})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={Brain} title="AI narrative">
          {ai.summary?.text && <p className="text-xs text-slate-800">{ai.summary.text}</p>}
          <ListBlock title="Needs attention" items={attention} />
          <ListBlock title="Recommendations" items={recommendations} />
          {!ai.summary?.text && !attention.length && !recommendations.length && (
            <p className="text-[10px] font-mono text-slate-400">This report has no narrative.</p>
          )}
        </Panel>
      </div>
    </div>
  );
};

const Panel: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  children,
}) => (
  <div className="p-4 bg-white border border-slate-300 space-y-3">
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
      <Icon className="w-4 h-4 text-indigo-600 mr-2" />
      {title}
    </h3>
    {children}
  </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border border-slate-200 bg-slate-50 p-2 min-w-0">
    <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 text-[11px] font-bold text-slate-800 break-words">{value}</p>
  </div>
);

const ListBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length ? (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</p>
      <ul className="list-disc pl-5 text-[11px] text-slate-700 space-y-0.5">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  ) : null;
