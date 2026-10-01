'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { WorkItemsBoard } from '@pages/common/WorkItemsBoard';
import { SprintIntelligence } from '@pages/csr-pages/SprintIntelligence';
import { SprintComparison } from '@pages/csr-pages/SprintComparison';
import { GithubAnalytics } from '@pages/common/GithubAnalytics';
import { PlanExecutionPanel } from '@pages/csr-pages/PlanExecutionPanel';
import { Collapsible } from '@shared/components/Collapsible';
import { listPlans, acceptPlan, getPlanExecution, listSprints } from '@core/services';
import {
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContributor,
  SavedPlan,
  PlanExecution,
  PlanSprint,
  TaigaSprint,
} from '@shared/models';

interface ExecutionProps {
  projectId: string;
  onToast: (m: string) => void;
  repositories: GitHubRepository[];
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  contributors: GitHubContributor[];
}

/**
 * Execution — what is actually happening in the project.
 * Top: the accepted plan's sprint-planning checklist (progress + sprints /
 * tasks / milestones / deadlines). Below: current sprint, work items, GitHub.
 * Every section is collapsible; the top one starts open, the rest collapsed.
 */
export const Execution: React.FC<ExecutionProps> = ({
  projectId,
  onToast,
  repositories,
  commits,
  pullRequests,
  contributors,
}) => {
  const [acceptedPlan, setAcceptedPlan] = useState<SavedPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadAcceptedPlan = async () => {
    setLoadingPlan(true);
    const rows = await listPlans(projectId);
    const acc = rows
      .filter((r) => r.status === 'accepted')
      .sort((a, b) =>
        (b.acceptedAt || b.createdAt || '').localeCompare(a.acceptedAt || a.createdAt || ''),
      );
    setAcceptedPlan(acc[0] || null);
    setLoadingPlan(false);
  };

  useEffect(() => {
    loadAcceptedPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const rebuild = async () => {
    if (!acceptedPlan) return;
    if (!window.confirm('Rebuild the checklist from the plan? This resets all progress.')) return;
    setRebuilding(true);
    try {
      const r = await acceptPlan(acceptedPlan.id, true);
      onToast(`Checklist rebuilt — ${r.itemsCreated} items.`);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      onToast(err?.msg || err?.message || 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <Activity className="w-4 h-4" />
        <span>Execution</span>
      </div>

      {/* ---- Sprint planning status (from the accepted plan) ---- */}
      <Collapsible
        title="Sprint planning status"
        defaultOpen
        right={
          acceptedPlan ? (
            <button
              onClick={rebuild}
              disabled={rebuilding}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
            >
              {rebuilding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 text-indigo-600" />
              )}
              <span>Rebuild</span>
            </button>
          ) : undefined
        }
      >
        {loadingPlan ? (
          <div className="flex items-center justify-center py-6 text-slate-500 text-xs font-mono uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading plan…
          </div>
        ) : !acceptedPlan ? (
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
            No accepted plan yet — generate one in the Plan tab and click “Accept plan”.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-black text-slate-900">{acceptedPlan.title}</div>
            <PlanExecutionPanel
              key={`${acceptedPlan.id}:${reloadKey}`}
              planId={acceptedPlan.id}
              onToast={onToast}
            />
          </div>
        )}
      </Collapsible>

      <Collapsible title="Current sprint">
        <SprintIntelligence projectId={projectId} />
      </Collapsible>

      <Collapsible title="Sprint comparison">
        <SprintComparisonSection projectId={projectId} />
      </Collapsible>

      <Collapsible title="Taiga sprint board" defaultOpen bodyClassName="">
        <WorkItemsBoard projectId={projectId} onToast={onToast} />
      </Collapsible>

      <Collapsible title="GitHub activity">
        <GithubAnalytics
          repositories={repositories}
          commits={commits}
          pullRequests={pullRequests}
          contributors={contributors}
        />
      </Collapsible>
    </div>
  );
};

const SprintComparisonSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [planSprints, setPlanSprints] = useState<PlanSprint[]>([]);
  const [execution, setExecution] = useState<PlanExecution | null>(null);
  const [taigaSprints, setTaigaSprints] = useState<TaigaSprint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listPlans(projectId), listSprints(projectId)]).then(async ([plans, sprints]) => {
      const accepted = plans
        .filter((plan) => plan.status === 'accepted')
        .sort((a, b) => (b.acceptedAt || b.createdAt || '').localeCompare(a.acceptedAt || a.createdAt || ''))[0];
      const executionData = accepted ? await getPlanExecution(accepted.id) : null;
      if (!alive) return;
      setPlanSprints(accepted?.plan?.sprints || []);
      setExecution(executionData);
      setTaigaSprints(sprints);
      setSelectedIndex('0');
      setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-xs font-mono text-slate-500"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading sprint comparison…</div>;
  }

  if (!planSprints.length) {
    return (
      <div className="p-5 text-slate-400 text-xs font-mono text-center">
        No accepted plan with sprints is available for comparison.
      </div>
    );
  }

  const planCompleted = execution?.sprints.filter((sprint) => sprint.isCompleted).length || 0;
  const taigaCompleted = taigaSprints.filter((sprint) => sprint.isClosed).length;
  const index = Math.min(Number(selectedIndex) || 0, planSprints.length - 1);
  const plannedSprint = planSprints[index];
  const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const taigaSprint = taigaSprints.find((sprint) => normalized(sprint.name) === normalized(plannedSprint.name))
    || taigaSprints.find((sprint) => normalized(sprint.name).includes(`sprint${plannedSprint.index}`))
    || taigaSprints[index]
    || null;
  const plannedCompleted = execution?.sprints[index]?.isCompleted
    ?? execution?.sprints.find((sprint) => normalized(sprint.title) === normalized(plannedSprint.name))?.isCompleted
    ?? false;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ComparisonCount label="Plan sprints" value={planSprints.length} tone="indigo" />
        <ComparisonCount label="Completed plan sprints" value={planCompleted} tone="emerald" />
        <ComparisonCount label="Taiga sprints" value={taigaSprints.length} tone="cyan" />
        <ComparisonCount label="Completed Taiga sprints" value={taigaCompleted} tone="emerald" />
      </div>

      <div className="p-4 bg-slate-50 border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Sprint-by-sprint comparison</h3>
          <p className="mt-1 text-[10px] font-mono text-slate-500">Planned scope on the left · synced Taiga delivery on the right</p>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Choose sprint</span>
          <select value={selectedIndex} onChange={(e) => setSelectedIndex(e.target.value)} className="min-w-48 bg-white border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500">
            {planSprints.map((sprint, sprintIndex) => <option key={`${sprint.index}-${sprint.name}`} value={sprintIndex}>{sprint.name || `Sprint ${sprint.index}`}</option>)}
          </select>
        </label>
      </div>

      <SprintComparison plannedSprint={plannedSprint} taigaSprint={taigaSprint} plannedCompleted={plannedCompleted} />
    </div>
  );
};

const ComparisonCount: React.FC<{ label: string; value: number; tone: 'indigo' | 'cyan' | 'emerald' }> = ({ label, value, tone }) => {
  const toneClass = tone === 'emerald' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : tone === 'cyan' ? 'text-cyan-700 border-cyan-300 bg-cyan-50' : 'text-indigo-700 border-indigo-300 bg-indigo-50';
  return <div className={`p-4 border ${toneClass}`}><span className="text-[9px] font-black uppercase tracking-widest">{label}</span><div className="mt-1 text-3xl font-black">{value}</div></div>;
};
