'use client';

import React from 'react';
import {
  Kanban,
  CheckSquare,
  Bug,
  ListTodo,
  Layers,
  ShieldAlert,
  UserCheck,
  Zap,
} from 'lucide-react';
import { TaigaSprint, TaigaStory, TaigaTask, TaigaIssue } from '@/types';

interface TaigaTrackingProps {
  sprints: TaigaSprint[];
  stories: TaigaStory[];
  tasks: TaigaTask[];
  issues: TaigaIssue[];
}

export const TaigaTracking: React.FC<TaigaTrackingProps> = ({
  sprints,
  stories,
  tasks,
  issues,
}) => {
  const activeSprint = sprints.find((s) => !s.isClosed) || sprints[0];

  const storiesByStatus = {
    BACKLOG: stories.filter((s) => s.status === 'BACKLOG'),
    IN_PROGRESS: stories.filter((s) => s.status === 'IN_PROGRESS'),
    IN_TESTING: stories.filter((s) => s.status === 'IN_TESTING'),
    DONE: stories.filter((s) => s.status === 'DONE'),
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'MEDIUM':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Active Sprint Progress Bar */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
              <Kanban className="w-4 h-4" />
              <span>Taiga Agile &amp; Sprint Management</span>
            </div>
            <h2 className="text-xl font-black italic tracking-tighter text-slate-900">
              {activeSprint ? activeSprint.name : 'Active Sprint'}
            </h2>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              Dates: {activeSprint?.startDate} to {activeSprint?.endDate}
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-50 p-3 border border-slate-300">
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Completed Points</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {activeSprint?.completedPoints} / {activeSprint?.totalPoints} pts
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-3 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-500"
            style={{
              width: `${Math.round(
                ((activeSprint?.completedPoints || 0) / Math.max(1, activeSprint?.totalPoints || 1)) * 100
              )}%`,
            }}
          />
        </div>
      </div>

      {/* User Stories Kanban State Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Backlog Column */}
        <div className="p-4 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-slate-300">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Backlog ({storiesByStatus.BACKLOG.length})
            </span>
            <span className="h-2 w-2 bg-slate-400" />
          </div>
          {storiesByStatus.BACKLOG.map((st) => (
            <div key={st.id} className="p-3 bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-900">{st.subject}</span>
                <span className="text-[9px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 border border-slate-300">
                  {st.storyPoints} pts
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{st.assignedTo}</span>
                <span className="text-indigo-700 font-bold">{st.type}</span>
              </div>
            </div>
          ))}
        </div>

        {/* In Progress Column */}
        <div className="p-4 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-indigo-600">
            <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">
              In Progress ({storiesByStatus.IN_PROGRESS.length})
            </span>
            <span className="h-2 w-2 bg-indigo-600 animate-pulse" />
          </div>
          {storiesByStatus.IN_PROGRESS.map((st) => (
            <div key={st.id} className="p-3 bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-900">{st.subject}</span>
                <span className="text-[9px] font-mono font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 border border-indigo-300">
                  {st.storyPoints} pts
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{st.assignedTo}</span>
                <span className="text-indigo-700 font-bold">{st.type}</span>
              </div>
            </div>
          ))}
        </div>

        {/* In Testing Column */}
        <div className="p-4 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-amber-500">
            <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
              In Testing ({storiesByStatus.IN_TESTING.length})
            </span>
            <span className="h-2 w-2 bg-amber-500" />
          </div>
          {storiesByStatus.IN_TESTING.map((st) => (
            <div key={st.id} className="p-3 bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-900">{st.subject}</span>
                <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                  {st.storyPoints} pts
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{st.assignedTo}</span>
                <span className="text-amber-700 font-bold">{st.type}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Done Column */}
        <div className="p-4 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-600">
            <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">
              Done ({storiesByStatus.DONE.length})
            </span>
            <span className="h-2 w-2 bg-emerald-600" />
          </div>
          {storiesByStatus.DONE.map((st) => (
            <div key={st.id} className="p-3 bg-slate-50 border border-slate-200 space-y-2 opacity-80">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-700 line-through">{st.subject}</span>
                <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-300">
                  {st.storyPoints} pts
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{st.assignedTo}</span>
                <span>{st.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Issues / Bugs Breakdown & Task Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taiga Issues & Bug Density */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <Bug className="w-4 h-4 text-rose-600 mr-2" />
            Open Issues &amp; Bug Severity
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">Taiga bug tracker severity hierarchy</p>

          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 bg-slate-50 border border-slate-200 flex items-start justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{issue.subject}</span>
                  <span className="text-[10px] font-mono text-slate-600 mt-1 block">
                    Assigned: <strong className="text-slate-900">{issue.assignedTo}</strong>
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border shrink-0 ${getSeverityBadge(
                    issue.severity
                  )}`}
                >
                  {issue.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Taiga Tasks Breakdown */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <CheckSquare className="w-4 h-4 text-indigo-600 mr-2" />
            Taiga Tasks Execution
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">Granular task completion status</p>

          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{task.subject}</span>
                  <span className="text-[10px] font-mono text-slate-600">Assigned: {task.assignedTo}</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                    task.status === 'CLOSED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  }`}
                >
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
