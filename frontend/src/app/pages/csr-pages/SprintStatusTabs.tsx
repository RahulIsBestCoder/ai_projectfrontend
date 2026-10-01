'use client';

import React, { useState } from 'react';
import { Layers, ListTodo, ListChecks } from 'lucide-react';

/** One bucket of `work_items.by_status` from GET /sprints/:id/summary. */
export interface StatusBucket {
  count: number;
  points: number;
}

const WORK_STATUS_ORDER = ['todo', 'inProgress', 'inReview', 'done'];

const WORK_STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#3b82f6' },
  inProgress: { label: 'In Progress', color: '#8b5cf6' },
  inReview: { label: 'In Review', color: '#f59e0b' },
  done: { label: 'Done', color: '#10b981' },
};

// Taiga-style palette used for status names (New, Ready, In progress, …).
const PALETTE = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#6b7280', '#0ea5e9'];

const pretty = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

interface SprintStatusTabsProps {
  /** Taiga-native statuses — `{ "New": 5, "In progress": 10, "Done": 8 }` (from sprint_summaries). */
  taigaStatusSummary?: Record<string, number> | null;
  taigaTotalTasks?: number;
  taigaCompletedTasks?: number;
  /** Normalized work-item roll-up (work_items collection, grouped by `status`). */
  byStatus?: Record<string, StatusBucket>;
  workTotal?: number;
  workPointsTotal?: number;
  workCompletionRate?: number;
  workPointsCompletionRate?: number;
}

export const SprintStatusTabs: React.FC<SprintStatusTabsProps> = ({
  taigaStatusSummary = null,
  taigaTotalTasks = 0,
  taigaCompletedTasks = 0,
  byStatus = {},
  workTotal = 0,
  workPointsTotal = 0,
  workCompletionRate = 0,
  workPointsCompletionRate = 0,
}) => {
  const taigaEntries = Object.entries(taigaStatusSummary || {});
  const [taigaActive, setTaigaActive] = useState('');

  const workKeys = WORK_STATUS_ORDER.concat(Object.keys(byStatus).filter((k) => !WORK_STATUS_ORDER.includes(k)));
  const workEntries = workKeys.map((key) => ({ key, bucket: byStatus[key] || { count: 0, points: 0 } }));
  const [workActive, setWorkActive] = useState(WORK_STATUS_ORDER[0]);

  return (
    <div className="space-y-4">
      {/* ---- Taiga-native statuses (status_summary from the board) ---- */}
      <div className="bg-white border border-slate-300">
        <div className="flex items-center space-x-2 px-4 pt-4 pb-2 border-b border-slate-100">
          <Layers className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
              Taiga status tabs
            </h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Task statuses as reported by the Taiga board
            </p>
          </div>
        </div>

        {taigaEntries.length === 0 ? (
          <p className="px-4 py-4 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            No Taiga status summary for this sprint yet — run a Taiga sync first.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {taigaEntries.map(([name, count], i) => {
                const color = PALETTE[i % PALETTE.length];
                const isActive = taigaActive === name;
                return (
                  <button
                    key={name}
                    onClick={() => setTaigaActive(isActive ? '' : name)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                      isActive ? 'text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    style={isActive ? { backgroundColor: color, borderColor: color } : { borderColor: color, color }}
                  >
                    <span className="w-2 h-2" style={{ backgroundColor: isActive ? '#fff' : color }} />
                    <span>{pretty(name)}</span>
                    <span
                      className="px-1.5 rounded-sm text-[9px] text-white"
                      style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : color }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-4 text-[10px] font-mono text-slate-500">
              <span>
                Total tasks: <strong className="text-slate-900">{taigaTotalTasks}</strong>
              </span>
              <span>
                Completed tasks:{' '}
                <strong className="text-emerald-700">{taigaCompletedTasks}</strong>
              </span>
              <span>
                Completion:{' '}
                <strong className="text-slate-900">
                  {taigaTotalTasks > 0 ? Math.round((taigaCompletedTasks / taigaTotalTasks) * 100) : 0}%
                </strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* ---- Normalized work-item roll-up (work_items.by_status) ---- */}
      <div className="bg-white border border-slate-300">
        <div className="flex items-center space-x-2 px-4 pt-4 pb-2 border-b border-slate-100">
          <ListTodo className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
              Work-item status tabs
            </h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              User stories grouped by status, with story points
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3">
          {workEntries.map(({ key, bucket }) => {
            const meta = WORK_STATUS_META[key];
            const color = meta?.color || PALETTE[workEntries.findIndex((e) => e.key === key) % PALETTE.length];
            const isEmpty = bucket.count === 0 && bucket.points === 0;
            const isActive = workActive === key;
            return (
              <button
                key={key}
                onClick={() => setWorkActive(key)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                  isEmpty ? 'opacity-45' : ''
                } ${isActive ? 'text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                style={isActive ? { backgroundColor: color, borderColor: color } : { borderColor: color, color }}
                title={`${meta?.label || pretty(key)} — ${bucket.count} items · ${bucket.points} pts`}
              >
                <span className="w-2 h-2" style={{ backgroundColor: isActive ? '#fff' : color }} />
                <span>{meta?.label || pretty(key)}</span>
                <span>{bucket.count}</span>
                <span className="text-[9px] opacity-70">{bucket.points}p</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
          <div className="p-3 bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Sections</span>
            <span className="text-lg font-black text-slate-900 font-mono">{workTotal}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total points</span>
            <span className="text-lg font-black text-slate-900 font-mono">{workPointsTotal}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Done by items</span>
            <span className="text-lg font-black text-emerald-700 font-mono">{workCompletionRate}%</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Done by points</span>
            <span className="text-lg font-black text-emerald-700 font-mono">{workPointsCompletionRate}%</span>
          </div>
        </div>
      </div>

      <p className="flex items-center space-x-1 text-[9px] font-mono text-slate-400 uppercase tracking-wider">
        <ListChecks className="w-3 h-3" />
        <span>Click a tab to highlight it — data comes from the sprint summary endpoint.</span>
      </p>
    </div>
  );
};