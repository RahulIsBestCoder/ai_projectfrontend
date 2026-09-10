'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { GaugeCircle, Loader2, ClipboardList } from 'lucide-react';
import { TaigaSprint } from '@/types';
import {
  listSprints,
  getSprintBurndown,
  getSprintBurnup,
  getSprintVelocity,
  getSprintSummary,
  getSprintRetrospective,
} from '@/lib/api';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#cbd5e1',
  borderRadius: '0px',
  color: '#0f172a',
  fontSize: '11px',
  fontFamily: 'monospace',
};

export const SprintIntelligence: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [sprints, setSprints] = useState<TaigaSprint[]>([]);
  const [sprintId, setSprintId] = useState<string>('');
  const [burndown, setBurndown] = useState<any[]>([]);
  const [burnup, setBurnup] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [retro, setRetro] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listSprints(projectId).then((s) => {
      if (!alive) return;
      setSprints(s);
      setSprintId(s[0]?.id || '');
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
      const [bd, bu, vel, sum, r] = await Promise.all([
        getSprintBurndown(sprintId),
        getSprintBurnup(sprintId),
        getSprintVelocity(sprintId),
        getSprintSummary(sprintId),
        getSprintRetrospective(sprintId),
      ]);
      if (!alive) return;
      setBurndown(bd as any[]);
      setBurnup(bu as any[]);
      setVelocity(vel as any[]);
      setSummary(sum);
      setRetro((r as any).notes || '');
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

      {loading ? (
        <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading sprint metrics…
        </div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile label="Velocity" value={`${summary.velocity}`} suffix="pts" />
              <Tile label="Burndown start" value={`${summary.burndownStart}`} suffix="pts" />
              <Tile label="Burndown end" value={`${summary.burndownEnd}`} suffix="pts" />
              <Tile label="Completion" value={`${summary.completionPercentage}%`} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Burndown — remaining points">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="remainingPoints" stroke="#e11d48" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Burnup — total vs completed">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burnup}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="totalPoints" name="Total" stroke="#94a3b8" fill="#e2e8f0" />
                  <Area type="monotone" dataKey="completedPoints" name="Completed" stroke="#4f46e5" fill="#c7d2fe" />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Velocity — points completed / day">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="pointsCompleted" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <div className="p-5 bg-white border border-slate-300 flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center mb-3">
                <ClipboardList className="w-4 h-4 text-indigo-600 mr-2" />
                Retrospective notes
              </h3>
              <textarea
                value={retro}
                onChange={(e) => setRetro(e.target.value)}
                className="flex-1 min-h-[180px] text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 p-3 focus:outline-none focus:border-indigo-400 resize-none"
              />
              <p className="text-[10px] text-slate-400 font-mono mt-2 uppercase tracking-wider">
                Draft only — persisted via PUT /sprints/:id when routes land
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-5 bg-white border border-slate-300">
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
      {title}
    </h3>
    <div className="h-56 w-full">{children}</div>
  </div>
);

const Tile: React.FC<{ label: string; value: string; suffix?: string }> = ({ label, value, suffix }) => (
  <div className="p-4 bg-white border border-slate-300">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    <div className="mt-2 flex items-baseline space-x-1">
      <span className="text-2xl font-black text-slate-900">{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);
