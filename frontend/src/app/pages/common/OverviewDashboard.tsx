'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Code2,
  Bug,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Flame,
  Brain,
  RefreshCw,
} from 'lucide-react';
import {
  Project,
  AIPrediction,
  GitHubRepository,
  GitHubPullRequest,
  GitHubCommit,
  CompletionForecast,
} from '@shared/models';
import { CalculatedAnalytics } from '@core/services/analytics-calculator';
import { Collapsible } from '@shared/components/Collapsible';
import type { SavedPlan } from '@shared/models';
import {
  PortfolioProjectHealth,
  getPortfolioProjectHealth,
  listPlans,
} from '@core/services';

/** Green 70–100 High, orange 40–69 Average, red 0–39 Low. */
const healthLevel = (score: number) =>
  score >= 70
    ? { label: 'High', text: 'text-emerald-700', bar: 'bg-emerald-600' }
    : score >= 40
      ? { label: 'Average', text: 'text-orange-600', bar: 'bg-orange-500' }
      : { label: 'Low', text: 'text-rose-700', bar: 'bg-rose-600' };

interface OverviewDashboardProps {
  project: Project;
  analytics: CalculatedAnalytics;
  prediction: AIPrediction | null;
  /** Real per-widget sources — the /analytics bundle zero-fills PR/churn/velocity,
   *  so these cards derive from the same raw data the GitHub/Sprint tabs use. */
  pullRequests: GitHubPullRequest[];
  commits: GitHubCommit[];
  repositories: GitHubRepository[];
  forecast: CompletionForecast | null;
  onNavigateToAi: () => void;
  /** Optional toast hook. When omitted the section still refreshes + shows its own status line. */
  onToast?: (m: string) => void;
}

const isValidDate = (v?: string | null) => !!v && !Number.isNaN(new Date(v).getTime());
const fmtDate = (v?: string | null, fallback = '—') =>
  isValidDate(v) ? new Date(v as string).toLocaleDateString() : fallback;
const fmtTime = (v?: string | null, fallback = 'Never') =>
  isValidDate(v) ? new Date(v as string).toLocaleTimeString() : fallback;

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  project,
  analytics,
  prediction,
  pullRequests,
  commits,
  forecast,
  onNavigateToAi,
  onToast,
}) => {
  const delayRisk = prediction ? prediction.delayProbability : project.delayProbability;

  // Real health score from GET /projects/:id/health (written by the AI health assessment).
  // The predictions endpoint has no health field, so `prediction.projectHealth` is always 0.
  const [health, setHealth] = useState<PortfolioProjectHealth | null>(null);
  const [healthLoaded, setHealthLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    getPortfolioProjectHealth(project.id)
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth(null))
      .finally(() => alive && setHealthLoaded(true));
    return () => {
      alive = false;
    };
  }, [project.id]);

  const dimension = (metric: string) =>
    health?.dimensions.find((d) => d.metric === metric)?.value ?? null;
  const assessedScore = health?.overall.score ?? null;
  const fallbackScore = (prediction?.projectHealth || project.healthScore) || null;
  const scoreValue = assessedScore ?? fallbackScore;
  const healthScore = Math.round(Math.max(0, Math.min(100, scoreValue ?? 0)));
  const hasHealthScore = scoreValue != null;
  const qualityScore = dimension('quality');
  const progressScore = dimension('progress');

  // ---- Planned (finish) deadline -------------------------------------------
  // Backend `projects.deadline` is unset today (always "Not set"), so derive the
  // planned finish from the accepted plan: last sprint endDate/deadline, then
  // plan deadlines[], then milestones[]. Falls back to forecast p50 only when
  // no plan date exists. Labelled with its source so AI vs plan dates agree.
  const [acceptedPlan, setAcceptedPlan] = useState<SavedPlan | null>(null);
  useEffect(() => {
    let alive = true;
    listPlans(project.id)
      .then((rows) => {
        if (!alive) return;
        const acc = (rows || [])
          .filter((r) => r.status === 'accepted')
          .sort((a, b) => (b.acceptedAt || b.createdAt || '').localeCompare(a.acceptedAt || a.createdAt || ''));
        setAcceptedPlan(acc[0] || null);
      })
      .catch(() => alive && setAcceptedPlan(null));
    return () => {
      alive = false;
    };
  }, [project.id]);

  const plannedDeadline = React.useMemo(() => {
    const candidates: { date: string; source: string }[] = [];
    if (isValidDate(project.deadline)) candidates.push({ date: project.deadline as string, source: 'project deadline' });
    const sprintsPlan = acceptedPlan?.plan?.sprints || [];
    const sprintEnds = sprintsPlan
      .map((s: any) => s.endDate || s.deadline)
      .filter((d: any): d is string => isValidDate(d));
    if (sprintEnds.length) {
      const latest = sprintEnds.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime()).pop() as string;
      candidates.push({ date: latest, source: `accepted plan · ${sprintsPlan.length} sprint${sprintsPlan.length === 1 ? '' : 's'} (${acceptedPlan?.title || 'plan'})` });
    }
    const planDeadlines = (acceptedPlan?.plan?.deadlines || [])
      .map((d: any) => d.date)
      .filter((d: any): d is string => isValidDate(d));
    if (planDeadlines.length) {
      const latest = planDeadlines.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime()).pop() as string;
      candidates.push({ date: latest, source: `accepted plan deadlines (${acceptedPlan?.title || 'plan'})` });
    }
    const milestoneDates = (acceptedPlan?.plan?.milestones || [])
      .map((m: any) => m.date)
      .filter((d: any): d is string => isValidDate(d));
    if (milestoneDates.length) {
      const latest = milestoneDates.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime()).pop() as string;
      candidates.push({ date: latest, source: `accepted plan milestones (${acceptedPlan?.title || 'plan'})` });
    }
    if (isValidDate(acceptedPlan?.input?.deadline)) {
      candidates.push({ date: acceptedPlan?.input?.deadline as string, source: 'plan requested deadline' });
    }
    // Prefer real plan dates over the project field; the project field only wins
    // when no plan exists at all.
    if (candidates.length === 1) return candidates[0];
    const planPick = candidates.find((c) => c.source.startsWith('accepted plan')) || candidates[0];
    return planPick || null;
  }, [project.deadline, acceptedPlan]);

  const plannedDeadlineLabel = plannedDeadline ? fmtDate(plannedDeadline.date, 'Not set') : 'Not set';
  const plannedDeadlineSource = plannedDeadline?.source
    ?? (acceptedPlan ? 'accepted plan has no dates yet' : forecast?.p50 ? 'no accepted plan — AI predicted finish below' : 'no accepted plan yet');

  /* Sprint delivery integration sync removed with the dashboard section.
  // Syncs every linked integration now (GitHub commits+PRs · Taiga work items +
  // sprints) instead of navigating away. Status line keeps last result visible.
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const runSectionSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Syncing integrations…');
    try {
      const rows: Array<{ id: string }> = [];
      if (!rows.length) {
        const msg = 'No integrations linked — connect GitHub/Taiga in Integrations first.';
        setSyncStatus(msg);
        onToast?.(msg);
        return;
      }
      const results = await Promise.allSettled(rows.map(() => Promise.resolve(null)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      const totals = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value?.itemsSynced?.total ?? r.value?.totals?.total ?? 0)
        .reduce((a, b) => a + (Number(b) || 0), 0);
      const msg = fail === 0
        ? `Synced ${ok}/${results.length} integration${results.length === 1 ? '' : 's'} · ${totals} items. Fresh data lands on next refresh.`
        : `Synced ${ok}/${results.length} — ${fail} failed. Retry from Integrations.`;
      setSyncStatus(msg);
      onToast?.(msg);
    } catch (err: any) {
      const msg = err?.msg || err?.message || 'Sync failed';
      setSyncStatus(msg);
      onToast?.(msg);
    } finally {
      setSyncing(false);
    }
  };

  */

  // ---- PR review latency: created_at -> merged_at, averaged over merged PRs.
  // The backend has no stored review-time metric, so this is the same proxy
  // the merge-latency chart itself would need. ---------------------------
  const mergedLatenciesHours = pullRequests
    .filter((pr) => pr.status === 'MERGED' && pr.mergedAt)
    .map((pr) => (new Date(pr.mergedAt as string).getTime() - new Date(pr.createdAt).getTime()) / 3600000)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgLatencyHours = mergedLatenciesHours.length
    ? Math.round(mergedLatenciesHours.reduce((a, b) => a + b, 0) / mergedLatenciesHours.length)
    : null;
  const staleOpenPrCount = pullRequests.filter(
    (pr) => pr.status === 'OPEN' && (Date.now() - new Date(pr.createdAt).getTime()) / 3600000 > 24,
  ).length;

  // ---- Code churn: sum straight from the commit feed. -------------------
  const churnAdditions = commits.reduce((s, c) => s + (c.additions || 0), 0);
  const churnDeletions = commits.reduce((s, c) => s + (c.deletions || 0), 0);
  const hasCommitData = commits.length > 0;
  const churnRatio =
    churnDeletions > 0 ? (churnAdditions / churnDeletions).toFixed(2) : churnAdditions > 0 ? '∞' : '—';

  // These signals are used by the live KPI cards below. They previously lived
  // inside the removed Sprint delivery block, which left the Overview render
  // referencing undefined variables and caused the whole section to crash.
  const hasPrData = pullRequests.length > 0;
  const forecastDelayRisk = forecast?.onTimeProbability != null
    ? Math.round((1 - forecast.onTimeProbability) * 100)
    : null;
  const hasPrediction = !!prediction && isValidDate(prediction.predictedFinishDate);
  const hasDelaySignal = forecastDelayRisk != null || hasPrediction;
  const effectiveDelayRisk = Math.max(
    0,
    Math.min(100, forecastDelayRisk ?? (Number.isFinite(delayRisk) ? delayRisk : 0)),
  );
  const confidenceValue = forecast?.confidencePct ?? (prediction ? prediction.confidence : null);

  /* Sprint delivery calculations removed with the dashboard section.
  const hasSprintData = sprints.length > 0;
  const activeSprint = sprints.find((s) => !s.isClosed) ?? sprints[sprints.length - 1];
  const [velocity, setVelocity] = useState<any>(null);
  const [velocityLoading, setVelocityLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!activeSprint?.id) {
      setVelocity(null);
      setVelocityLoading(false);
      return () => { alive = false; };
    }
    setVelocityLoading(true);
    setVelocity(null);
    Promise.resolve(null)
      .then((result) => alive && setVelocity(result))
      .finally(() => alive && setVelocityLoading(false));
    return () => { alive = false; };
  }, [activeSprint?.id]);

  const velocityHistory = velocity?.velocity.sprints.map((sprint) => ({
    sprintName: sprint.name,
    status: sprint.status,
    planned: sprint.plannedPoints,
    completed: sprint.completedPoints,
    completionRate: sprint.completionRate,
    isCurrent: sprint.isCurrent,
  })) ?? [];
  const hasVelocityHistory = velocityHistory.length > 0;
  const selectedSprint = velocity?.sprint;
  const activeSprintPct = selectedSprint
    ? Math.round((selectedSprint.completedPoints / Math.max(1, selectedSprint.plannedPoints)) * 100)
    : activeSprint
      ? Math.round((activeSprint.completedPoints / Math.max(1, activeSprint.totalPoints)) * 100)
    : null;

  // Daily burndown is loaded only for the selected active sprint. The endpoint
  // returns actual history when completion timestamps exist and marks estimated
  // history explicitly; the UI never invents a line locally.
  const [burndown, setBurndown] = useState<Array<{ date: string; day: number; idealRemaining: number; actualRemaining: number | null }>>([]);
  useEffect(() => {
    let alive = true;
    if (!activeSprint?.id) {
      setBurndown([]);
      return () => { alive = false; };
    }
    Promise.resolve([])
      .then((rows) => alive && setBurndown(rows as any))
      .catch(() => alive && setBurndown([]));
    return () => { alive = false; };
  }, [activeSprint?.id]);

  const completedVelocity = velocityHistory.map((row) => ({
    sprintName: row.sprintName,
    status: row.status,
    planned: row.planned,
    completed: row.completed,
    completionRate: row.completionRate,
    isCurrent: row.isCurrent,
  }));
  const unfinishedPoints = sprints.reduce((sum, sprint) => sum + Math.max(0, sprint.totalPoints - sprint.completedPoints), 0);
  const totalPlannedPoints = sprints.reduce((sum, sprint) => sum + sprint.totalPoints, 0);
  const unfinishedPct = totalPlannedPoints > 0 ? Math.round((unfinishedPoints / totalPlannedPoints) * 100) : null;
  const recentGitActivity = commits.filter((commit) => Date.now() - new Date(commit.commitDate).getTime() <= 14 * 86400000).length;

  // Feature evidence is deliberately conservative: it matches meaningful words
  // from planned feature names against commit messages and PR titles. It is
  // evidence of activity, not a claim that implementation is complete.
  const evidenceText = [...commits.map((commit) => commit.message), ...pullRequests.map((pr) => pr.title)].map((text) => text.toLowerCase());
  const featureEvidence = (acceptedPlan?.input?.features || []).slice(0, 6).map((feature) => {
    const tokens = feature.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
    const matches = evidenceText.filter((text) => tokens.some((token) => text.includes(token))).length;
    return { feature, matches, evidence: evidenceText.length ? Math.min(100, Math.round(matches / evidenceText.length * 100)) : 0 };
  });

  const velocityTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: typeof velocityHistory[number] }> }) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;
    return (
      <div className="border border-slate-300 bg-white px-3 py-2 text-[10px] font-mono text-slate-700 shadow-sm">
        <div className="font-bold text-slate-900">{point.sprintName}{point.isCurrent ? ' · Current' : ''}</div>
        <div>{point.status}</div>
        <div>Planned: {point.planned} pts</div>
        <div>Completed: {point.completed} pts</div>
        <div>Completion: {point.completionRate == null ? '—' : `${point.completionRate}%`}</div>
      </div>
    );
  };

  // ---- AI delay risk: prefer the Monte-Carlo forecast's on-time
  // probability when the backend sends it; otherwise fall back to the risk
  // prediction used everywhere else in the app. ---------------------------
  const forecastDelayRisk =
    forecast?.onTimeProbability != null ? Math.round((1 - forecast.onTimeProbability) * 100) : null;
  const hasPrediction = !!prediction && isValidDate(prediction.predictedFinishDate);
  const hasDelaySignal = forecastDelayRisk != null || hasPrediction;
  const effectiveDelayRisk = forecastDelayRisk ?? delayRisk;
  const confidenceValue = forecast?.confidencePct ?? (prediction ? prediction.confidence : null);
  const deadlineRiskLabel = effectiveDelayRisk >= 60 ? 'High' : effectiveDelayRisk >= 30 ? 'Medium' : 'Low';
  const riskBars = [
    { label: 'QA bottleneck', value: analytics.qaCapacity.capacityPercentage || null, display: analytics.qaCapacity.ratio },
    { label: 'Unfinished work', value: unfinishedPct, display: unfinishedPoints ? `${unfinishedPoints} pts` : unfinishedPct == null ? '—' : '0 pts' },
    { label: 'Deadline risk', value: hasDelaySignal ? effectiveDelayRisk : null, display: hasDelaySignal ? deadlineRiskLabel : '—' },
    { label: 'Git activity (14d)', value: recentGitActivity ? Math.min(100, recentGitActivity * 10) : null, display: `${recentGitActivity} commits` },
  ];

  const hasPrData = pullRequests.length > 0;
  */

  const hasData =
    hasHealthScore ||
    hasCommitData ||
    hasPrData ||
    analytics.healthScore > 0 ||
    analytics.prMetrics.totalPrs > 0 ||
    analytics.codeChurn.additions > 0 ||
    analytics.codeChurn.deletions > 0 ||
    analytics.sprintMetrics.totalPoints > 0 ||
    (analytics.sprintMetrics.velocityHistory?.length ?? 0) > 0;
  const unsynced = !hasData && !hasDelaySignal;

  // ON TRACK / AT RISK / DELAYED — from health score + delay-risk probability,
  // not from delay-risk alone (a healthy project with a small risk blip should
  // not read as delayed).
  const computeStatusBadge = (health: number, riskPct: number) => {
    const risk = riskPct / 100;
    if (health < 50 || risk >= 0.6) {
      return {
        label: 'DELAYED',
        bg: 'bg-rose-100 border-rose-300 text-rose-800',
        ring: 'border-rose-500 text-rose-700',
      };
    }
    if (health < 70 || risk >= 0.3) {
      return {
        label: 'AT RISK',
        bg: 'bg-amber-100 border-amber-300 text-amber-800',
        ring: 'border-amber-500 text-amber-700',
      };
    }
    return {
      label: 'ON TRACK',
      bg: 'bg-emerald-100 border-emerald-300 text-emerald-800',
      ring: 'border-emerald-500 text-emerald-700',
    };
  };

  const riskBadge = unsynced
    ? {
        label: 'AWAITING SYNC DATA',
        bg: 'bg-slate-100 border-slate-300 text-slate-600',
        ring: 'border-slate-400 text-slate-600',
      }
    : computeStatusBadge(healthScore, effectiveDelayRisk);

  return (
    <div className="space-y-6">
      {/* Top Banner: Project Title & Quick Stats */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${riskBadge.bg}`}>
                {riskBadge.label}
              </span>
              <span className="text-[10px] text-slate-500 font-mono uppercase flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Last Synced: {fmtTime(project.lastSyncAt, 'Never synced')}
              </span>
            </div>
            <h2 className="text-xl font-black italic tracking-tighter text-slate-900">{project.name}</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl font-sans">{project.description}</p>
          </div>

          {/* Forecast vs Deadline */}
          <div className="flex items-center space-x-4 bg-slate-50 p-4 border border-slate-300">
            <div className="text-center px-3 border-r border-slate-300">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                Planned Deadline
              </span>
              <div className="flex items-center justify-center text-slate-900 font-mono font-bold text-xs" title={plannedDeadlineSource}>
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {plannedDeadlineLabel}
              </div>
              <div className="mt-0.5 text-[9px] font-mono text-slate-400 max-w-40 truncate" title={plannedDeadlineSource}>
                {plannedDeadlineSource}
              </div>
            </div>
            <div className="text-center px-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                AI Predicted Finish
              </span>
              <div
                className={`flex items-center font-mono font-bold text-xs ${
                  delayRisk > 50 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                <Flame className="w-3.5 h-3.5 mr-1.5" />
                {hasPrediction ? fmtDate(prediction!.predictedFinishDate) : 'Not synced yet'}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Grid: Health Meter & Key KPI Cards */}
      <Collapsible title="Key metrics" defaultOpen bodyClassName="">
      {unsynced && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <span>No synced data for this project yet — trigger a sync to populate these metrics.</span>
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Health Meter */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Health Score
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-4 flex items-center justify-between">
            <div>
              <div className={`text-3xl font-black ${hasHealthScore ? healthLevel(healthScore).text : 'text-slate-400'}`}>
                {!healthLoaded && !hasHealthScore ? '…' : hasHealthScore ? healthScore : '—'}
              </div>
              {hasHealthScore && (
                <span className={`text-[10px] font-mono font-bold uppercase ${healthLevel(healthScore).text}`}>
                  {healthLevel(healthScore).label}
                  {health?.overall.trend && health.overall.trend !== 'unknown' ? ` · ${health.overall.trend}` : ''}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-500 text-right">
              / 100
              <div
                className="w-20 bg-slate-200 h-2 mt-1.5 overflow-hidden"
                role="meter"
                aria-label="Health score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={hasHealthScore ? healthScore : undefined}
              >
                <div
                  className={`h-full ${healthLevel(healthScore).bar}`}
                  style={{ width: `${hasHealthScore ? healthScore : 0}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {assessedScore != null ? (
              <>
                Quality <span className="font-bold text-slate-900">{qualityScore == null ? '—' : `${Math.round(qualityScore)}%`}</span>
                {' · '}
                Progress <span className="font-bold text-slate-900">{progressScore == null ? '—' : `${Math.round(progressScore)}%`}</span>
              </>
            ) : healthLoaded ? (
              'No AI health score yet — run the assessment on the Health tab.'
            ) : (
              'Loading health score…'
            )}
          </p>
        </div>

        {/* AI Delivery Delay Risk */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center">
              <Brain className="w-3.5 h-3.5 mr-1" />
              AI Delay Risk
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="my-4 flex items-baseline justify-between">
            <div
              className={`text-3xl font-black ${
                !hasDelaySignal
                  ? 'text-slate-400'
                  : effectiveDelayRisk > 70
                  ? 'text-rose-600'
                  : effectiveDelayRisk > 40
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {hasDelaySignal ? `${effectiveDelayRisk}%` : '—'}
            </div>
            <button
              onClick={onNavigateToAi}
              className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider flex items-center"
            >
              Explain AI
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Confidence: <span className="text-slate-900 font-bold">{confidenceValue != null ? `${confidenceValue}%` : '—'}</span>
          </p>
        </div>

        {/* PR Review Latency */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              PR Review Latency
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-4">
            <div className="text-3xl font-black text-slate-900">
              {avgLatencyHours != null ? `${avgLatencyHours} hrs` : '—'}
            </div>
            {staleOpenPrCount > 0 && (
              <span className="inline-block mt-1 text-[9px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                {staleOpenPrCount} Stale (&gt;24h)
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Healthy benchmark: &lt;12h turnaround.
          </p>
        </div>

        {/* Code Churn */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Code Churn
            </span>
            <Code2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="my-4">
            {hasCommitData ? (
              <>
                <div className="flex items-baseline space-x-2 font-mono">
                  <span className="text-base font-black text-emerald-600">
                    +{churnAdditions.toLocaleString()}
                  </span>
                  <span className="text-base font-black text-rose-600">
                    -{churnDeletions.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Churn ratio: <span className="font-bold text-slate-900">{churnRatio}</span>
                </div>
              </>
            ) : (
              <div className="text-3xl font-black text-slate-400">—</div>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Refactoring vs feature addition.
          </p>
        </div>
      </div>

      </Collapsible>

      {/*
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-5 gap-px border border-slate-300 bg-slate-300">
          {[
            ['Project avg', velocity?.velocity.projectAverage == null ? '—' : `${velocity.velocity.projectAverage} pts`],
            ['Last 3 avg', velocity?.velocity.last3Average == null ? '—' : `${velocity.velocity.last3Average} pts`],
            ['Change', velocity?.velocity.changePoints == null ? '—' : `${velocity.velocity.changePoints > 0 ? '+' : ''}${velocity.velocity.changePoints} pts`],
            ['Trend', velocity?.velocity.trendDirection.replace('_', ' ') ?? 'insufficient data'],
            ['Sample', velocity ? `${velocity.velocity.sampleSize} completed` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-black capitalize text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <div className="p-5 bg-white border border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
                <TrendingDown className="w-4 h-4 text-indigo-600 mr-2" />
                Sprint Velocity
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Planned vs completed story points
              </p>
            </div>
            <span className="px-2 py-1 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-800">
              Active Sprint: {activeSprintPct != null ? `${activeSprintPct}% Done` : '—'}
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {velocityLoading ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 uppercase tracking-widest">Loading velocity…</div>
            ) : !activeSprint ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center px-4">No sprint is available.</div>
            ) : !velocity ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center px-4">Velocity data could not be loaded.</div>
            ) : !hasVelocityHistory ? (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center px-4">
                No sprint data yet — sync Taiga to populate velocity.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="sprintName" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} label={{ value: 'Story points', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <Tooltip content={velocityTooltip} />
                  <Legend />
                  <Bar dataKey="planned" name="Planned Points" fill="#4f46e5" />
                  <Bar dataKey="completed" name="Completed Points" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-[9px] text-slate-400 font-mono">Story points are team estimates, not individual productivity measurements.</p>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">Velocity Trend</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Historical completed story points</p>
          <div className="h-64 mt-4">
            {velocityLoading ? <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400">Loading velocity…</div> : !velocity ? <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400">No velocity data available.</div> : !hasVelocityHistory ? <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400">No sprint history available.</div> : (
              <ResponsiveContainer width="100%" height="100%"><LineChart data={completedVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="sprintName" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip content={velocityTooltip} />
                {velocity.velocity.projectAverage != null && <ReferenceLine y={velocity.velocity.projectAverage} stroke="#4f46e5" strokeDasharray="4 4" label="Project avg" />}
                {velocity.velocity.last3Average != null && <ReferenceLine y={velocity.velocity.last3Average} stroke="#ea580c" strokeDasharray="4 4" label="Last 3 avg" />}
                <Line type="monotone" dataKey="completed" name="Completed Points" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart></ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">Sprint Burndown</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-1">{activeSprint?.name || 'Active sprint'} · remaining work vs sprint days</p>
          <div className="h-64 mt-4">
            {!burndown.length || !activeSprint?.totalPoints ? <div className="h-full flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 text-center px-4">Burndown requires sprint dates, planned points and completion history.</div> : (
              <ResponsiveContainer width="100%" height="100%"><LineChart data={burndown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="idealRemaining" name="Ideal Remaining" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="actualRemaining" name="Actual Remaining" stroke="#e11d48" strokeWidth={3} connectNulls={false} />
              </LineChart></ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">Git + Taiga Feature Progress</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Implementation evidence matched to planned features</p>
          <div className="mt-5 space-y-4">
            {!featureEvidence.length ? <div className="h-48 flex items-center justify-center border border-dashed border-slate-300 text-[10px] font-mono text-slate-400 text-center px-4">Accept a plan with named features to enable evidence matching.</div> : featureEvidence.map((item) => (
              <div key={item.feature}>
                <div className="flex justify-between gap-3 text-[10px] font-mono"><span className="truncate text-slate-700" title={item.feature}>{item.feature}</span><span className="font-bold text-indigo-700">{item.evidence}% · {item.matches} matches</span></div>
                <div className="mt-1 h-2 bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${item.evidence}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[9px] text-slate-400 font-mono">Commit and PR matches are supporting evidence; they do not prove feature completion.</p>
        </div>

        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-amber-500 pb-1 w-fit flex items-center"><AlertTriangle className="w-4 h-4 text-amber-600 mr-2" />Active Risk Factors</h3><button onClick={onNavigateToAi} className="text-[10px] font-bold text-indigo-600 hover:underline uppercase">Deep AI</button></div>
            <div className="mt-5 space-y-4">{riskBars.map((risk) => (
              <div key={risk.label}>
                <div className="flex justify-between text-[10px] font-mono"><span>{risk.label}</span><span className="font-bold text-slate-800">{risk.display}</span></div>
                <div className="mt-1 h-2 bg-slate-200"><div className={`h-full ${(risk.value ?? 0) >= 60 ? 'bg-rose-600' : (risk.value ?? 0) >= 30 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${risk.value ?? 0}%` }} /></div>
              </div>
            ))}</div>
            {project.keyRiskFactors.length > 0 && <ul className="mt-4 list-disc pl-4 text-[10px] text-slate-600 space-y-1">{project.keyRiskFactors.map((risk, index) => <li key={index}>{risk}</li>)}</ul>}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-300">
            <button onClick={() => void runSectionSync()} disabled={syncing} className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50 inline-flex items-center justify-center gap-2">{syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{syncing ? 'Syncing…' : 'Refresh Git + Taiga Data'}</button>
            {syncStatus && <p className="mt-1.5 text-[10px] font-mono text-slate-500 flex gap-1.5"><CalendarClock className="w-3 h-3 mt-0.5 shrink-0 text-indigo-500" />{syncStatus}</p>}
          </div>
        </div>
      </div>
      */}
    </div>
  );
};
