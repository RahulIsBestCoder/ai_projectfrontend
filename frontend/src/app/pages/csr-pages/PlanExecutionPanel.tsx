'use client';

import React, { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { PlanExecution, ExecutionItem, ExecutionKind, ExecutionProgress } from '@shared/models';
import { getPlanExecution, toggleExecutionItem } from '@core/services';

const KIND_LABEL: Record<ExecutionKind, string> = {
  sprint: 'sprint',
  task: 'task',
  milestone: 'milestone',
  deadline: 'deadline',
  dependency: 'dependency',
};

export const PlanExecutionPanel: React.FC<{
  planId: string;
  onToast: (m: string) => void;
  onProgress?: (p: ExecutionProgress) => void;
}> = ({ planId, onToast, onProgress }) => {
  const [exec, setExec] = useState<PlanExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPlanExecution(planId).then((e) => {
      if (!alive) return;
      setExec(e);
      setLoading(false);
      if (e) onProgress?.(e.progress);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  /** Immutably flip is_completed on the item with `id`, wherever it sits. */
  const flip = (e: PlanExecution, id: string, value: boolean): PlanExecution => {
    const upd = (it: ExecutionItem): ExecutionItem =>
      it.id === id ? { ...it, isCompleted: value } : it;
    return {
      ...e,
      sprints: e.sprints.map((s) => ({
        ...upd(s),
        tasks: s.tasks.map(upd),
        dependencies: s.dependencies.map(upd),
      })) as PlanExecution['sprints'],
      milestones: e.milestones.map(upd),
      deadlines: e.deadlines.map(upd),
    };
  };

  const toggle = async (kind: ExecutionKind, item: ExecutionItem) => {
    if (!exec || pending.has(item.id)) return;
    const next = !item.isCompleted;
    setPending((p) => new Set(p).add(item.id));
    setExec((e) => (e ? flip(e, item.id, next) : e)); // optimistic
    try {
      const res = await toggleExecutionItem(planId, kind, item.id, next);
      setExec((e) => (e ? { ...flip(e, item.id, res.isCompleted), progress: res.progress } : e));
      onProgress?.(res.progress);
    } catch (err: any) {
      setExec((e) => (e ? flip(e, item.id, item.isCompleted) : e)); // rollback
      onToast(err?.msg || err?.message || 'Could not update the item');
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(item.id);
        return n;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <ThemedLoader label="Loading execution" />
      </div>
    );
  }
  if (!exec) {
    return (
      <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
        No execution data — accept the plan first.
      </p>
    );
  }
  if (exec.progress.total === 0) {
    return (
      <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
        Nothing to track in this plan.
      </p>
    );
  }

  const { progress } = exec;

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
        <ListChecks className="w-3.5 h-3.5" />
        <span>Execution checklist</span>
      </div>

      {/* progress */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
          <span>Progress</span>
          <span>
            {progress.completed} / {progress.total} · {progress.percent}%
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2">
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(Object.keys(progress.byKind) as ExecutionKind[]).map((k) => (
            <span
              key={k}
              className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 uppercase"
            >
              {KIND_LABEL[k]} {progress.byKind[k].completed}/{progress.byKind[k].total}
            </span>
          ))}
        </div>
      </div>

      {/* sprints */}
      <div className="space-y-2">
        {exec.sprints.map((s) => (
          <div key={s.id} className="border border-slate-200 bg-slate-50">
            <div className="px-3 py-2 border-b border-slate-200">
              <Row item={s} kind="sprint" pending={pending} onToggle={toggle} strong />
              {s.meta && (
                <div className="ml-6 text-[10px] font-mono text-slate-400">
                  {[s.meta.startDate, s.meta.endDate].filter(Boolean).join(' → ')}
                  {s.meta.plannedPoints != null ? ` · ${s.meta.plannedPoints} pts` : ''}
                </div>
              )}
            </div>
            {(s.dependencies.length > 0 || s.tasks.length > 0) && (
              <div className="p-2 space-y-1">
                {s.dependencies.map((d) => (
                  <Row
                    key={d.id}
                    item={{
                      ...d,
                      title: d.meta?.dependsOnKey
                        ? `Blocked by ${String(d.meta.dependsOnKey).replace('-', ' ')}`
                        : d.title,
                    }}
                    kind="dependency"
                    pending={pending}
                    onToggle={toggle}
                    muted
                  />
                ))}
                {s.tasks.map((t) => (
                  <div key={t.id}>
                    <Row item={t} kind="task" pending={pending} onToggle={toggle} />
                    {t.meta && (
                      <div className="ml-6 text-[9px] font-mono text-slate-400">
                        {[t.meta.assigneeRole, t.meta.priority, t.meta.storyPoints != null ? `${t.meta.storyPoints} s.pt` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {exec.milestones.length > 0 && (
        <Section title="Milestones">
          {exec.milestones.map((m) => (
            <Row key={m.id} item={m} kind="milestone" pending={pending} onToggle={toggle} trailing={m.meta?.date} />
          ))}
        </Section>
      )}
      {exec.deadlines.length > 0 && (
        <Section title="Deadlines">
          {exec.deadlines.map((d) => (
            <Row key={d.id} item={d} kind="deadline" pending={pending} onToggle={toggle} trailing={d.meta?.date} />
          ))}
        </Section>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</div>
    <div className="border border-slate-200 bg-slate-50 p-2 space-y-1">{children}</div>
  </div>
);

const Row: React.FC<{
  item: ExecutionItem;
  kind: ExecutionKind;
  pending: Set<string>;
  onToggle: (kind: ExecutionKind, item: ExecutionItem) => void;
  strong?: boolean;
  muted?: boolean;
  trailing?: string;
}> = ({ item, kind, pending, onToggle, strong, muted, trailing }) => (
  <label className="flex items-center gap-2 cursor-pointer w-full">
    <input
      type="checkbox"
      checked={item.isCompleted}
      disabled={pending.has(item.id)}
      onChange={() => onToggle(kind, item)}
      className="accent-indigo-600 w-3.5 h-3.5 shrink-0"
    />
    <span
      className={`flex-1 min-w-0 truncate text-[11px] ${
        strong ? 'font-black uppercase tracking-wider text-slate-900' : 'font-mono'
      } ${muted ? 'text-slate-500 italic' : 'text-slate-700'} ${
        item.isCompleted ? 'line-through opacity-60' : ''
      }`}
    >
      {item.title}
    </span>
    <span
      className={`inline-flex items-center justify-center min-w-[62px] px-1.5 py-0.5 text-[9px] font-mono font-black uppercase border ${
        item.isCompleted
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : 'bg-amber-100 text-amber-800 border-amber-300'
      }`}
    >
      {item.isCompleted ? 'complete' : 'inprogress'}
    </span>
    {trailing && <span className="text-[9px] font-mono text-slate-400 shrink-0">{trailing}</span>}
  </label>
);
