'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Kanban, Loader2, GripVertical, Bug, Sparkles, Wrench, Boxes } from 'lucide-react';
import { TaigaStory, TaigaSprint } from '@/types';
import {
  listWorkItems,
  listSprints,
  updateWorkItemStatus,
  updateWorkItemAssignee,
  updateWorkItemPriority,
} from '@/lib/api';

interface WorkItemsBoardProps {
  projectId: string;
  onToast: (msg: string) => void;
}

const COLUMNS: { key: TaigaStory['status']; label: string }[] = [
  { key: 'BACKLOG', label: 'Backlog' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_TESTING', label: 'In Testing' },
  { key: 'DONE', label: 'Done' },
];

const TYPE_META: Record<string, { icon: React.ElementType; cls: string }> = {
  FEATURE: { icon: Sparkles, cls: 'text-indigo-600' },
  BUG: { icon: Bug, cls: 'text-rose-600' },
  REFACTOR: { icon: Wrench, cls: 'text-amber-600' },
  TECH_DEBT: { icon: Boxes, cls: 'text-slate-500' },
};

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const WorkItemsBoard: React.FC<WorkItemsBoardProps> = ({ projectId, onToast }) => {
  const [stories, setStories] = useState<TaigaStory[] | null>(null);
  const [sprints, setSprints] = useState<TaigaSprint[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [sprintFilter, setSprintFilter] = useState('ALL');

  useEffect(() => {
    let alive = true;
    (async () => {
      setStories(null);
      const [w, s] = await Promise.all([listWorkItems(projectId), listSprints(projectId)]);
      if (!alive) return;
      setStories(w.stories);
      setSprints(s);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assignees = useMemo(
    () => Array.from(new Set((stories || []).map((s) => s.assignedTo))).filter(Boolean),
    [stories]
  );

  const filtered = (stories || []).filter(
    (s) =>
      (typeFilter === 'ALL' || s.type === typeFilter) &&
      (assigneeFilter === 'ALL' || s.assignedTo === assigneeFilter) &&
      (sprintFilter === 'ALL' || s.sprintId === sprintFilter)
  );

  const move = async (id: string, status: TaigaStory['status']) => {
    setStories((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, status } : s)) : prev));
    try {
      await updateWorkItemStatus(id, status);
      onToast(`Work item moved to ${status.replace('_', ' ')}`);
    } catch {
      onToast('Status update failed — reverting');
      const w = await listWorkItems(projectId);
      setStories(w.stories);
    }
  };

  const setAssignee = async (id: string, name: string) => {
    setStories((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, assignedTo: name } : s)) : prev));
    try {
      await updateWorkItemAssignee(id, name);
    } catch {
      onToast('Assignee update failed');
    }
  };

  const setPriority = async (id: string, p: string) => {
    try {
      await updateWorkItemPriority(id, p);
      onToast(`Priority set to ${p}`);
    } catch {
      onToast('Priority update failed');
    }
  };

  if (!stories) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading board…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <Kanban className="w-4 h-4" />
          <span>Work Items — Kanban</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onChange={setTypeFilter} options={['ALL', 'FEATURE', 'BUG', 'REFACTOR', 'TECH_DEBT']} label="Type" />
          <Select value={assigneeFilter} onChange={setAssigneeFilter} options={['ALL', ...assignees]} label="Assignee" />
          <Select
            value={sprintFilter}
            onChange={setSprintFilter}
            options={['ALL', ...sprints.map((s) => s.id)]}
            labels={{ ALL: 'ALL', ...Object.fromEntries(sprints.map((s) => [s.id, s.name.split(' - ')[0]])) }}
            label="Sprint"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = filtered.filter((s) => s.status === col.key);
          const pts = items.reduce((sum, s) => sum + s.storyPoints, 0);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag) move(drag, col.key);
                setDrag(null);
              }}
              className="bg-slate-100 border border-slate-300 min-h-[220px] flex flex-col"
            >
              <div className="px-3 py-2 border-b border-slate-300 flex items-center justify-between bg-white">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">{col.label}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {items.length} • {pts}p
                </span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.map((s) => {
                  const meta = TYPE_META[s.type] || TYPE_META.TECH_DEBT;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDrag(s.id)}
                      onDragEnd={() => setDrag(null)}
                      className={`bg-white border border-slate-300 p-2.5 cursor-grab active:cursor-grabbing ${
                        drag === s.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-800 leading-snug flex-1">{s.subject}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2 pl-5">
                        <span className={`inline-flex items-center text-[10px] font-mono font-bold uppercase ${meta.cls}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {s.type}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1">
                          {s.storyPoints}p
                        </span>
                      </div>
                      <div className="mt-2 pl-5 flex items-center gap-1.5">
                        <select
                          value={s.assignedTo}
                          onChange={(e) => setAssignee(s.id, e.target.value)}
                          className="text-[10px] font-mono bg-slate-50 border border-slate-200 px-1 py-0.5 text-slate-700 max-w-[7rem]"
                        >
                          {[s.assignedTo, ...assignees.filter((a) => a !== s.assignedTo)].map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <select
                          defaultValue="MEDIUM"
                          onChange={(e) => setPriority(s.id, e.target.value)}
                          className="text-[10px] font-mono bg-slate-50 border border-slate-200 px-1 py-0.5 text-slate-700"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
                {!items.length && (
                  <p className="text-[10px] text-slate-400 font-mono text-center py-6 uppercase tracking-wider">Drop here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  label: string;
}> = ({ value, onChange, options, labels, label }) => (
  <label className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 px-2 py-1">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-[11px] font-mono font-bold uppercase text-slate-800 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  </label>
);
