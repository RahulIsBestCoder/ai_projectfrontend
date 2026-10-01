'use client';

import React, { useEffect, useState } from 'react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import {
  LayoutGrid,
  ShieldAlert,
  Activity,
  TriangleAlert,
  ArrowUpRight,
  Loader2,
  Plus,
  X,
  CalendarClock,
  Brain,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Collapsible } from '@shared/components/Collapsible';
import {
  createProject,
  getPortfolioCompletionForecast,
  getPortfolioOrganization,
  getPortfolioProjectHealth,
  getPortfolioProjects,
  PortfolioProjectCard,
  PortfolioProjectRow,
  getAiDashboard,
  AiDashboard,
  AiDashboardCard,
  AiDashboardTotals,
  updateProject,
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
import type { ManualCompletion } from '@core/services/manualCompletion';
import {
  getManualCompletion,
  getManualCompletions,
  saveManualCompletion,
  clearManualCompletion,
} from '@core/services/manualCompletion';

interface PortfolioDashboardProps {
  organizationName: string;
  organizationId?: string;
  ownerId?: string;
  selectedProjectId: string;
  /** `snapshot` carries the card's health/forecast and AI report so Overview renders instantly. */
  onOpenProject: (id: string, snapshot?: ProjectOpenSnapshot) => void;
  onProjectCreated?: () => void;
  onToast?: (m: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'cancelled', label: 'Cancelled' },
];

function band(score: number) {
  if (score >= 75) return { fill: '#059669', text: 'text-emerald-700', label: 'Healthy' };
  if (score >= 50) return { fill: '#d97706', text: 'text-amber-700', label: 'Watch' };
  return { fill: '#e11d48', text: 'text-rose-700', label: 'Critical' };
}

/**
 * Completion value for the project-card donut.
 * Priority: AI-report implemented % (plan-execution checklist basis) → manual
 * entry (local fallback for projects with no report yet) → active sprint
 * completion % → null (no completion evidence yet). Health stays as the text
 * line beside the donut; the ring itself answers "how much is done?".
 */
function completionOf(
  ai?: AiDashboardCard | null,
  manual?: ManualCompletion | null,
): { value: number | null; basis: string } {
  const implemented = ai?.implementation?.completePercent;
  if (implemented != null) return { value: implemented, basis: 'AI report · implemented' };
  if (manual != null) return { value: manual.value, basis: `Manual entry · ${new Date(manual.updatedAt).toLocaleDateString()}` };
  const sprintRate = ai?.velocity?.completionRate;
  if (sprintRate != null) {
    const name = ai?.velocity?.sprintName ? ` · ${ai.velocity.sprintName}` : '';
    return { value: sprintRate, basis: `Sprint completion${name}` };
  }
  return { value: null, basis: 'Enter completion manually or generate an AI report' };
}

const CompletionRing: React.FC<{
  ai?: AiDashboardCard | null;
  manual?: ManualCompletion | null;
  projectId: string;
  projectName: string;
  onSaved: () => void;
}> = ({ ai, manual, projectId, projectName, onSaved }) => {
  const { value: score, basis } = completionOf(ai, manual);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(manual ? String(manual.value) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError('Enter 0–100.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      saveManualCompletion(projectId, Math.round(n));
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  const clear = () => {
    clearManualCompletion(projectId);
    setEditing(false);
    setDraft('');
    setError(null);
    onSaved();
  };

  useEffect(() => {
    setDraft(manual ? String(manual.value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual?.value, manual?.updatedAt]);

  const hasRealEvidence = ai?.implementation?.completePercent != null || ai?.velocity?.completionRate != null;

  const editor = (
    <div className="w-full border border-slate-300 bg-slate-50 p-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
        Manual completion · {projectName}
      </p>
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="numeric"
          placeholder="0–100"
          aria-label={`Manual completion percent for ${projectName}`}
          className="w-full min-w-0 px-1.5 py-1 text-xs font-mono border border-slate-300 focus:outline-none"
        />
        <span className="text-[10px] font-bold text-slate-500">%</span>
      </div>
      {error && <p className="text-[8px] font-mono text-rose-600">{error}</p>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-2 py-1 bg-slate-900 text-white text-[8px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null); setDraft(manual ? String(manual.value) : ''); }}
          className="px-2 py-1 bg-white border border-slate-300 text-[8px] font-bold uppercase tracking-wider text-slate-600"
        >
          Cancel
        </button>
        {manual && (
          <button type="button" onClick={clear} className="ml-auto text-[8px] font-mono text-rose-600 underline">
            Clear
          </button>
        )}
      </div>
      <p className="text-[8px] font-mono text-slate-400 leading-tight">
        Local fallback only — an AI report or scored sprint replaces it automatically.
      </p>
    </div>
  );

  if (score == null) {
    return (
      <div className="flex flex-col items-center gap-1 shrink-0 w-20">
        <div className="w-20 h-20 border-4 border-dashed border-slate-200 flex items-center justify-center text-center text-[9px] font-bold text-slate-500 leading-tight px-1">
          No completion data yet
        </div>
        <p className="text-[8px] font-mono text-slate-400 text-center leading-tight" title={basis}>{basis}</p>
        {editing ? editor : (
          <button type="button" onClick={() => { setDraft(''); setEditing(true); }} className="text-[8px] font-bold uppercase tracking-wider text-indigo-600 hover:underline">
            + Set manually
          </button>
        )}
      </div>
    );
  }
  const renderedScore = Math.max(0, Math.min(100, Math.round(score)));
  const b = band(renderedScore);
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-20">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={[{ value: renderedScore, fill: b.fill }]}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-black leading-none ${b.text}`}>{renderedScore}%</span>
        </div>
      </div>
      <p className="text-[8px] font-mono text-slate-400 text-center leading-tight truncate w-full" title={basis}>{basis}</p>
      {editing ? editor : (
        <button
          type="button"
          onClick={() => { setDraft(manual ? String(manual.value) : String(renderedScore)); setEditing(true); }}
          title={hasRealEvidence ? 'Real evidence drives this ring — manual edit is ignored until the report/sprint clears' : 'Adjust the local fallback value'}
          className="text-[8px] font-mono text-slate-400 hover:text-indigo-600 hover:underline"
        >
          {manual && !hasRealEvidence ? 'manual · edit' : 'set manually'}
        </button>
      )}
    </div>
  );
};

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  organizationName,
  organizationId,
  ownerId,
  selectedProjectId,
  onOpenProject,
  onProjectCreated,
  onToast,
}) => {
  const [projects, setProjects] = useState<PortfolioProjectRow[] | null>(null);
  const [cards, setCards] = useState<PortfolioProjectCard[]>([]);
  const [portfolioName, setPortfolioName] = useState(organizationName);
  const [totalProjects, setTotalProjects] = useState(0);
  const [cardBusy, setCardBusy] = useState<Record<string, string>>({});
  const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [archiveScope, setArchiveScope] = useState<'main' | 'archived'>('main');
  const [aiDashboard, setAiDashboard] = useState<AiDashboard | null>(null);
  const [aiDashboardError, setAiDashboardError] = useState<string | null>(null);
  const [manualTick, setManualTick] = useState(0);
  // Manual-completion fallback state (localStorage seeds). Must live with the
  // other top-level hooks — declaring it after the `!projects` early return
  // below changes hook order between renders and crashes React (blank page).
  const [seededManual, setSeededManual] = useState<Map<string, ManualCompletion>>(new Map());
  const cardIdKey = cards.map((c) => c.id).join(',');
  useEffect(() => {
    if (!cards.length) return;
    const names = new Map(cards.map((c) => [c.id, c.name]));
    const seeded = getManualCompletions(cards.map((c) => c.id), names);
    setSeededManual(new Map(Object.entries(seeded)));
    // Seeds write to localStorage → bump so rings re-read on first paint.
    if (Object.keys(seeded).length) setManualTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdKey]);

  const loadAiDashboard = async (projectIds?: string[]) => {
    try {
      setAiDashboard(projectIds?.length ? await getAiDashboard(projectIds) : null);
      setAiDashboardError(null);
    } catch (err: any) {
      setAiDashboard(null);
      setAiDashboardError(err?.msg || err?.message || 'AI dashboard is unavailable.');
    }
  };

  const loadCard = async (projectId: string) => {
    setCardLoading((current) => ({ ...current, [projectId]: true }));
    try {
      const [healthResult, forecastResult] = await Promise.allSettled([
        getPortfolioProjectHealth(projectId),
        getPortfolioCompletionForecast(projectId),
      ]);
      const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
      const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : null;
      setCards((current) => current.map((card) =>
        card.id === projectId ? hydrateCard(card, health, forecast) : card
      ));
    } finally {
      setCardLoading((current) => ({ ...current, [projectId]: false }));
    }
  };

  const load = async () => {
    if (!organizationId) {
      setProjects([]);
      setCards([]);
      setTotalProjects(0);
      return;
    }
    const [organization, projectList] = await Promise.all([
      getPortfolioOrganization(organizationId),
      getPortfolioProjects(organizationId, archiveScope),
    ]);
    setPortfolioName(organization.name);
    setProjects(projectList.rows);
    setTotalProjects(projectList.total);
    setCards(projectList.rows.map(baseCard));
    void loadAiDashboard(projectList.rows.map((project) => project.id));

    let cursor = 0;
    const workers = Array.from({ length: Math.min(5, projectList.rows.length) }, async () => {
      while (cursor < projectList.rows.length) {
        const project = projectList.rows[cursor++];
        await loadCard(project.id);
      }
    });
    await Promise.all(workers);
  };

  useEffect(() => {
    let alive = true;
    // The effect intentionally resets and hydrates organization-scoped dashboard state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((err: any) => {
      if (!alive) return;
      setProjects([]);
      onToast?.(err?.msg || err?.message || 'Could not load the portfolio.');
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, archiveScope]);

  // The backend's token exchange returns no user object, so `ownerId` is usually
  // empty. Fall back to the org/owner of an existing project (same org, valid
  // user); the modal lets the user paste ids if nothing can be derived.
  const firstWithOwner = (projects ?? []).find((p) => (p as any).ownerId);
  const firstWithOrg = (projects ?? []).find((p) => p.organizationId);
  const seedOrgId = organizationId || (firstWithOrg?.organizationId ?? '');
  const seedOwnerId = ownerId || ((firstWithOwner as any)?.ownerId ?? '');

  if (!projects) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <ThemedLoader label="Loading portfolio" />
      </div>
    );
  }

  const totalRisks = cards.reduce((sum, card) => sum + (card.healthUnavailable ? 0 : card.openRisks), 0);
  const atRisk = cards.filter((card) => card.deliveryStatus === 'at_risk' || card.deliveryStatus === 'off_track').length;
  const aiCardById = new Map((aiDashboard?.rows ?? []).map((row) => [row.project.id, row]));

  // Portfolio average completion: AI evidence first, manual fallback per card.
  void manualTick;
  const completionValues = cards.map((c) => {
    const ai = aiCardById.get(c.id);
    if (ai?.implementation?.completePercent != null) return ai.implementation.completePercent;
    const manual = getManualCompletion(c.id) ?? seededManual.get(c.id) ?? null;
    if (manual != null) return manual.value;
    return ai?.velocity?.completionRate ?? null;
  }).filter((v): v is number => v != null);
  const avgCompletion = completionValues.length
    ? Math.round(completionValues.reduce((s, v) => s + v, 0) / completionValues.length)
    : null;

  const changeArchiveStatus = async (project: PortfolioProjectCard) => {
    const archiving = archiveScope === 'main';
    setCardBusy((current) => ({ ...current, [project.id]: archiving ? 'archive' : 'restore' }));
    try {
      await updateProject(project.id, { status: (archiving ? 'archived' : 'active') as any });
      onToast?.(`Project "${project.name}" ${archiving ? 'archived' : 'restored'}.`);
      await load();
      onProjectCreated?.();
    } catch (err: any) {
      onToast?.(err?.msg || err?.message || `Could not ${archiving ? 'archive' : 'restore'} the project.`);
    } finally {
      setCardBusy((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
              <LayoutGrid className="w-4 h-4" />
              <span>Organisation Portfolio</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {portfolioName || 'Organisation'}
            </h1>
            <p className="text-xs text-slate-600 font-mono mt-0.5">
              {totalProjects} projects • cross-project health, progress and delivery risk
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            title="Create a new project"
            className="shrink-0 flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-300">
        <button
          type="button"
          onClick={() => setArchiveScope('main')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 ${archiveScope === 'main' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}
        >
          Main projects
        </button>
        <button
          type="button"
          onClick={() => setArchiveScope('archived')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 ${archiveScope === 'archived' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}
        >
          <Archive className="w-3.5 h-3.5" /> Archive
        </button>
      </div>

      {projects.length === 0 && (
        <div className="p-6 bg-white border border-slate-300 text-xs font-mono text-slate-500">
          {archiveScope === 'archived'
            ? 'No archived projects.'
            : <>No projects yet. Click <span className="text-indigo-700 font-bold">Create Project</span> to add the first one.</>}
        </div>
      )}

      {/* Portfolio strip */}
      {archiveScope === 'main' && projects.length > 0 && (
        <Collapsible title="Portfolio summary" defaultOpen bodyClassName="">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat icon={Activity} label="Average completion" value={avgCompletion == null ? '—' : `${avgCompletion}%`} suffix={avgCompletion == null ? 'No completion data' : `across ${completionValues.length} of ${cards.length} projects`} tone={avgCompletion == null ? 'text-slate-500' : band(avgCompletion).text} />
          <Stat icon={ShieldAlert} label="Open risk factors" value={`${totalRisks}`} tone="text-rose-700" />
          <Stat icon={TriangleAlert} label="Projects at risk" value={`${atRisk}`} suffix={`of ${projects.length}`} tone={atRisk ? 'text-amber-700' : 'text-emerald-700'} />
        </div>
        </Collapsible>
      )}

      {/* AI report summary — averages from unfinished projects' latest saved reports. */}
      {archiveScope === 'main' && projects.length > 0 && (
        <Collapsible
          title="AI report summary · unfinished projects"
          defaultOpen
          subtitle={aiDashboard ? `${aiDashboard.totals.reports.withReport}/${aiDashboard.totals.reports.totalProjects}` : undefined}
          bodyClassName=""
        >
          {aiDashboardError ? (
            <div className="p-4 bg-white border border-slate-300 flex items-center justify-between gap-3 text-xs font-mono text-rose-700">
              <span>{aiDashboardError}</span>
              <button type="button" onClick={() => void loadAiDashboard(cards.map((card) => card.id))} className="text-[10px] font-bold uppercase text-amber-700">
                Retry
              </button>
            </div>
          ) : aiDashboard ? (
            <AiDashboardSummary totals={aiDashboard.totals} />
          ) : (
            <p className="p-4 bg-white border border-slate-300 inline-flex items-center text-[10px] font-bold uppercase text-slate-500">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading AI reports
            </p>
          )}
        </Collapsible>
      )}

      {/* Project cards — donut = completion (AI report → manual fallback → sprint). Health stays as a text line. */}
      <Collapsible title={archiveScope === 'archived' ? 'Archived projects' : 'Projects'} defaultOpen subtitle={`${totalProjects}`} bodyClassName="">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((p) => {
          const ai = aiCardById.get(p.id);
          // Re-read localStorage via manualTick so a save re-renders every card + the average.
          void manualTick;
          const manual = getManualCompletion(p.id) ?? seededManual.get(p.id) ?? null;
          const { value: completionValue, basis: completionBasis } = completionOf(ai, manual);
          const ringScore = completionValue == null ? null : Math.max(0, Math.min(100, Math.round(completionValue)));
          const b = ringScore == null ? null : band(ringScore);
          const isActive = p.id === selectedProjectId;
          return (
            <div
              key={p.id}
              className={`text-left p-5 bg-white border-2 transition flex flex-col gap-4 ${
                isActive ? 'border-indigo-600 shadow-xs' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">{p.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 line-clamp-2">{p.description}</p>
                </div>
                <CompletionRing
                  ai={ai}
                  manual={manual}
                  projectId={p.id}
                  projectName={p.name}
                  onSaved={() => setManualTick((t) => t + 1)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase mb-1">
                  <span>Completion: {completionValue == null ? '—' : `${ringScore}%`}{ai?.implementation?.basis ? ` · ${ai.implementation.basis}` : ''}</span>
                  <span
                    className={`px-1.5 py-0.5 border font-bold ${
                      p.deliveryStatus === 'on_track'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : p.deliveryStatus === 'at_risk'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : p.deliveryStatus === 'off_track'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {p.deliveryStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2" title={completionBasis}>
                  {ringScore != null && <div className="h-full" style={{ width: `${ringScore}%`, backgroundColor: b?.fill }} />}
                </div>
                <p className="mt-1 text-[10px] font-mono text-slate-500">
                  Health: {p.healthScore == null ? 'unknown' : `${p.healthScore}`} · {p.healthStatus} · {p.healthTrend}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <CardValue label="Open risks" value={p.healthUnavailable ? '—' : String(p.openRisks)} />
                <CardValue label="Delay" value={p.delayPercent == null ? 'Prediction unavailable' : `${p.delayPercent}%`} />
                <CardValue label="Predicted completion" value={p.predictedCompletionDate
                  ? new Date(p.predictedCompletionDate).toLocaleDateString()
                  : p.forecastStatus === 'insufficient_data'
                    ? 'Complete at least one scored sprint'
                    : p.forecastUnavailable ? 'Unavailable' : 'Not enough data'} />
                <CardValue label="Remaining scope" value={p.remainingStoryPoints == null ? '—' : `${p.remainingStoryPoints} points`} />
              </div>
              {aiDashboard && <AiReportStrip card={aiCardById.get(p.id)} />}
              {p.forecastConfidence && <p className="text-[10px] text-slate-500">Forecast confidence: <strong>{p.forecastConfidence}</strong></p>}
              {cardLoading[p.id] ? (
                <p className="inline-flex items-center text-[10px] font-bold uppercase text-slate-500">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading health and forecast
                </p>
              ) : (p.healthUnavailable || p.forecastUnavailable) && (
                <button type="button" onClick={() => void loadCard(p.id)} className="text-[10px] font-bold uppercase text-amber-700 self-start">
                  Retry unavailable data
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                <button type="button" onClick={() => onOpenProject(p.id, { card: p, ai: aiCardById.get(p.id) ?? null })} className="ml-auto flex items-center text-[10px] text-indigo-600 font-bold uppercase">
                  Open <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void changeArchiveStatus(p)}
                  disabled={!!cardBusy[p.id]}
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 disabled:opacity-40"
                >
                  {archiveScope === 'archived' ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                  {archiveScope === 'archived' ? 'Restore' : 'Archive'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </Collapsible>

      {showCreate && (
        <CreateProjectModal
          organizationName={portfolioName}
          organizationId={seedOrgId}
          ownerId={seedOwnerId}
          onClose={() => setShowCreate(false)}
          onToast={onToast}
          onCreated={async (id) => {
            setShowCreate(false);
            await load();
            void loadAiDashboard();
            onProjectCreated?.();
            if (id) onOpenProject(id);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Create-project modal
// ---------------------------------------------------------------------------

const CreateProjectModal: React.FC<{
  organizationName: string;
  organizationId: string;
  ownerId: string;
  onClose: () => void;
  onCreated: (id?: string) => void;
  onToast?: (m: string) => void;
}> = ({ organizationName, organizationId, ownerId, onClose, onCreated, onToast }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [orgId, setOrgId] = useState(organizationId);
  const [owner, setOwner] = useState(ownerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!orgId.trim() || !owner.trim()) {
      setError('Organisation id and owner id are required by the backend. Paste them below.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        organizationId: orgId.trim(),
        ownerId: owner.trim(),
        status: status as any,
      });
      onToast?.(`Project "${name.trim()}" created.`);
      onCreated(created?.id || created?._id);
    } catch (err: any) {
      setError(err?.msg || err?.message || 'Could not create the project.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white border-2 border-slate-900 shadow-xl mt-16"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Name *
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App"
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short summary of what this project delivers"
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Organisation id *
              </span>
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                readOnly={Boolean(organizationId)}
                placeholder="Mongo ObjectId"
                className={`w-full border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none ${
                  organizationId ? 'bg-slate-100' : 'bg-slate-50'
                }`}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Owner id *
              </span>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                readOnly={Boolean(ownerId)}
                placeholder="user _id"
                className={`w-full border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none ${
                  ownerId ? 'bg-slate-100' : 'bg-slate-50'
                }`}
              />
            </label>
          </div>
          {!organizationId && !owner && (
            <p className="text-[10px] font-mono text-slate-400">
              The session provides no user id, so these were taken from an existing project.
              Adjust if you need a different owner.
            </p>
          )}
          <p className="text-[10px] font-mono text-slate-400">
            Organisation: <span className="text-slate-600">{organizationName || orgId || '—'}</span>
          </p>

          {error && (
            <p className="text-[11px] font-mono text-rose-600 border border-rose-200 bg-rose-50 px-2.5 py-1.5">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim() || !orgId.trim() || !owner.trim()}
            className="flex items-center space-x-2 px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-widest border border-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{busy ? 'Creating…' : 'Create'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

const Stat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}> = ({ icon: Icon, label, value, suffix, tone = 'text-slate-900' }) => (
  <div className="p-5 bg-white border border-slate-300">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <Icon className="w-4 h-4 text-indigo-600" />
    </div>
    <div className="mt-3 flex items-baseline space-x-2">
      <span className={`text-3xl font-black ${tone}`}>{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);

const CardValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border border-slate-200 bg-slate-50 p-2 min-w-0">
    <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 text-[10px] font-bold text-slate-800 break-words">{value}</p>
  </div>
);

// ---------------------------------------------------------------------------
// AI dashboard (saved reports)
// ---------------------------------------------------------------------------

const AiDashboardSummary: React.FC<{ totals: AiDashboardTotals }> = ({ totals }) => {
  const { reports, implementation, health, risk, forecast } = totals;
  const latestFinish = forecast.latestExpectedCompletionDate
    ? new Date(forecast.latestExpectedCompletionDate).toLocaleDateString()
    : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={Brain}
          label="Average implemented"
          value={pctText(implementation.completePercent)}
          suffix={`${implementation.tasks.completed}/${implementation.tasks.total} tasks`}
          tone="text-violet-700"
        />
        <Stat
          icon={Activity}
          label="Average report health"
          value={health.avgScore == null ? '—' : `${Math.round(health.avgScore)}`}
          suffix={health.avgScore == null ? 'No reports' : '/ 100'}
          tone={health.avgScore == null ? 'text-slate-500' : band(health.avgScore).text}
        />
        <Stat
          icon={CalendarClock}
          label="Average on-time probability"
          value={pctText(probabilityPercent(forecast.avgDeadlineProbability))}
          suffix={latestFinish ? `latest finish ${latestFinish}` : undefined}
          tone="text-indigo-700"
        />
        <Stat
          icon={LayoutGrid}
          label="Unfinished AI reports"
          value={`${reports.withReport}`}
          suffix={`of ${reports.totalProjects} · ${reports.stale} stale`}
          tone={reports.missing ? 'text-amber-700' : 'text-emerald-700'}
        />
      </div>
      <p className="text-[10px] font-mono text-slate-600">
        Features: {countsText(implementation.features)} &nbsp;|&nbsp; Overall risk: {countsText(risk.byOverall)}
        {implementation.tasks.blocked > 0 && <> &nbsp;|&nbsp; Blocked tasks: {implementation.tasks.blocked}</>}
      </p>
    </div>
  );
};

const AiReportStrip: React.FC<{ card?: AiDashboardCard }> = ({ card }) => {
  if (!card) return null;
  if (!card.implementation) {
    return (
      <p className="text-[10px] font-mono text-slate-500 border border-dashed border-slate-300 p-2">
        No AI report yet. Generate one from Reports.
      </p>
    );
  }
  const attention = itemText(card.summary?.needsAttention?.[0]);
  return (
    <div className="border border-violet-200 bg-violet-50 p-2 space-y-2">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-violet-800">
        <span className="inline-flex items-center gap-1 font-bold">
          <Brain className="w-3 h-3" /> AI report
        </span>
        <span className={card.report.stale ? 'text-amber-700 font-bold' : ''}>
          {card.report.stale
            ? 'Stale'
            : card.report.generatedAt
              ? new Date(card.report.generatedAt).toLocaleDateString()
              : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <CardValue label="Implemented" value={pctText(card.implementation.completePercent)} />
        <CardValue label="Overall risk" value={card.risk?.overall ?? 'unknown'} />
      </div>
      {attention && <p className="text-[10px] text-slate-700 line-clamp-2">Needs attention: {attention}</p>}
    </div>
  );
};
