'use client';

import React, { useEffect, useState } from 'react';
import { GaugeCircle } from 'lucide-react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { Collapsible } from '@shared/components/Collapsible';
import { SprintStatusTabs } from '@pages/csr-pages/SprintStatusTabs';
import { TaigaSprint } from '@shared/models';
import { listSprints, getActiveSprint, getSprintSummary } from '@core/services';

export const SprintIntelligence: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [sprints, setSprints] = useState<TaigaSprint[]>([]);
  const [sprintId, setSprintId] = useState<string>('');
  const [activeSprintId, setActiveSprintId] = useState<string>('');
  const [activeSprintName, setActiveSprintName] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([listSprints(projectId), getActiveSprint(projectId)]).then(([s, active]) => {
      if (!alive) return;
      setSprints(s);
      // Default to the backend's "current" (active) sprint so status tabs open on it.
      setSprintId(active?.id || s[0]?.id || '');
      setActiveSprintId(active?.id || '');
      setActiveSprintName(active?.name || '');
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!sprintId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const sum = await getSprintSummary(sprintId);
      if (!alive) return;
      setSummary(sum);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sprintId]);

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <GaugeCircle className="w-4 h-4" />
          <span>Sprint Intelligence</span>
        </div>
        <div className="flex items-center space-x-2">
          {sprintId && sprintId === activeSprintId && (
            <span
              title={activeSprintName ? `Current sprint: ${activeSprintName}` : 'Current sprint'}
              className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-mono font-bold uppercase tracking-wider"
            >
              Current
            </span>
          )}
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            className="bg-slate-50 border border-slate-300 px-3 py-1.5 text-xs font-mono font-bold uppercase text-slate-800 focus:outline-none"
          >
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
          <ThemedLoader label="Loading sprint metrics" />
        </div>
      ) : (
        summary && (
          <Collapsible title="Sprint status & summary" defaultOpen bodyClassName="">
            <div className="p-5 bg-white border-b border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-black text-slate-900">
                    {summary.sprint?.name || 'Sprint'}
                  </span>
                  {summary.sprint?.status === 'active' ? (
                    <span className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-mono font-bold uppercase">
                      Active
                    </span>
                  ) : summary.sprint?.status ? (
                    <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 text-[9px] font-mono font-bold uppercase">
                      {summary.sprint.status}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {summary.sprint?.startDate ? new Date(summary.sprint.startDate).toLocaleDateString() : '—'}
                  {' → '}
                  {summary.sprint?.endDate ? new Date(summary.sprint.endDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile label="Total Sections" value={`${summary.workItems?.total ?? 0}`} />
                <Tile label="Total points" value={`${summary.workItems?.pointsTotal ?? 0}`} suffix="pts" />
                <Tile label="Completion" value={`${summary.workItems?.completionRate ?? 0}%`} />
                <Tile label="Points done" value={`${summary.workItems?.pointsCompletionRate ?? 0}%`} />
              </div>
            </div>
            <div className="p-5">
              <SprintStatusTabs
                key={summary.sprint?.id || sprintId}
                taigaStatusSummary={summary.taiga?.statusSummary}
                taigaTotalTasks={summary.taiga?.totalTasks}
                taigaCompletedTasks={summary.taiga?.completedTasks}
                byStatus={summary.workItems?.byStatus}
                workTotal={summary.workItems?.total}
                workPointsTotal={summary.workItems?.pointsTotal}
                workCompletionRate={summary.workItems?.completionRate}
                workPointsCompletionRate={summary.workItems?.pointsCompletionRate}
              />
            </div>
          </Collapsible>
        )
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string; suffix?: string }> = ({ label, value, suffix }) => (
  <div className="p-4 bg-white border border-slate-300">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    <div className="mt-2 flex items-baseline space-x-1">
      <span className="text-2xl font-black text-slate-900">{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);
