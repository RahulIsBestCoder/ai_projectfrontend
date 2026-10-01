'use client';

import React from 'react';
import { CalendarDays, CheckCircle2, Circle, ClipboardList, Target } from 'lucide-react';
import { PlanSprint, TaigaSprint } from '@shared/models';

interface SprintComparisonProps {
  plannedSprint: PlanSprint;
  taigaSprint: TaigaSprint | null;
  plannedCompleted: boolean;
}

const date = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

export const SprintComparison: React.FC<SprintComparisonProps> = ({
  plannedSprint,
  taigaSprint,
  plannedCompleted,
}) => {
  const plannedPoints = plannedSprint.plannedPoints
    ?? plannedSprint.tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
  const taigaRate = taigaSprint?.totalPoints
    ? Math.round((taigaSprint.completedPoints / taigaSprint.totalPoints) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SprintPanel
        side="Planned sprint"
        name={plannedSprint.name || `Sprint ${plannedSprint.index}`}
        completed={plannedCompleted}
        start={plannedSprint.startDate}
        end={plannedSprint.endDate || plannedSprint.deadline}
        points={`${plannedPoints} planned points`}
        itemCount={`${plannedSprint.tasks.length} planned tasks`}
        accent="indigo"
      >
        {plannedSprint.goal && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 text-[11px] text-slate-700">
            <strong className="block text-[9px] uppercase tracking-widest text-indigo-600 mb-1">Goal</strong>
            {plannedSprint.goal}
          </div>
        )}
        <TaskList tasks={plannedSprint.tasks.map((task) => task.title)} empty="No tasks in the planned sprint." />
      </SprintPanel>

      {taigaSprint ? (
        <SprintPanel
          side="Taiga sprint"
          name={taigaSprint.name}
          completed={taigaSprint.isClosed}
          start={taigaSprint.startDate}
          end={taigaSprint.endDate}
          points={`${taigaSprint.completedPoints} / ${taigaSprint.totalPoints} completed points`}
          itemCount={`${taigaRate}% point completion`}
          accent="emerald"
        >
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>Delivery progress</span><span>{taigaRate}%</span>
            </div>
            <div className="h-3 bg-slate-200 overflow-hidden">
              <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, taigaRate)}%` }} />
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Taiga milestone ID: {taigaSprint.taigaMilestoneId ?? '—'}
            </p>
          </div>
        </SprintPanel>
      ) : (
        <div className="min-h-72 p-6 bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
          <Target className="w-7 h-7 text-slate-300 mb-2" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">No matching Taiga sprint</h3>
          <p className="mt-2 max-w-sm text-[11px] font-mono text-slate-500">
            Publish or sync this planned sprint to Taiga. Matching uses the sprint name first and its position as a fallback.
          </p>
        </div>
      )}
    </div>
  );
};

const SprintPanel: React.FC<{
  side: string; name: string; completed: boolean; start?: string; end?: string;
  points: string; itemCount: string; accent: 'indigo' | 'emerald'; children: React.ReactNode;
}> = ({ side, name, completed, start, end, points, itemCount, accent, children }) => (
  <section className={`bg-white border-2 ${accent === 'indigo' ? 'border-indigo-300' : 'border-emerald-300'}`}>
    <header className={`p-4 border-b ${accent === 'indigo' ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${accent === 'indigo' ? 'text-indigo-700' : 'text-emerald-700'}`}>{side}</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border ${completed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
          {completed ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          {completed ? 'Completed' : 'Open'}
        </span>
      </div>
      <h3 className="mt-2 text-base font-black text-slate-900">{name}</h3>
    </header>
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Mini icon={CalendarDays} label="Dates" value={`${date(start)} – ${date(end)}`} />
        <Mini icon={Target} label="Points" value={points} />
        <Mini icon={ClipboardList} label="Scope" value={itemCount} className="col-span-2" />
      </div>
      {children}
    </div>
  </section>
);

const Mini: React.FC<{ icon: React.ElementType; label: string; value: string; className?: string }> = ({ icon: Icon, label, value, className = '' }) => (
  <div className={`p-3 bg-slate-50 border border-slate-200 ${className}`}>
    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400"><Icon className="w-3 h-3" />{label}</span>
    <p className="mt-1 text-[11px] font-bold text-slate-800">{value}</p>
  </div>
);

const TaskList: React.FC<{ tasks: string[]; empty: string }> = ({ tasks, empty }) => tasks.length ? (
  <div>
    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Planned task scope</h4>
    <ul className="space-y-1 max-h-44 overflow-y-auto">
      {tasks.map((task, index) => <li key={`${task}-${index}`} className="flex gap-2 p-2 bg-slate-50 border border-slate-200 text-[11px] text-slate-700"><span className="font-mono text-indigo-500">{index + 1}.</span><span>{task}</span></li>)}
    </ul>
  </div>
) : <p className="text-[11px] font-mono text-slate-400">{empty}</p>;
