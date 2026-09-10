'use client';

import React, { useEffect, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity, Loader2, GitBranch } from 'lucide-react';
import {
  ProjectHealthDetail,
  HealthStrategy,
  TrendPoint,
  DepartmentMetrics,
  Department,
} from '@/types';
import {
  getProjectHealth,
  getHealthStrategies,
  setHealthStrategy,
  getAnalyticsTrends,
  getDoraMetrics,
  getGitActivity,
  listDepartments,
  getDepartmentMetrics,
} from '@/lib/api';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#cbd5e1',
  borderRadius: '0px',
  color: '#0f172a',
  fontSize: '11px',
  fontFamily: 'monospace',
};

export const ProjectAnalytics: React.FC<{
  projectId: string;
  organizationId?: string;
  onToast: (m: string) => void;
}> = ({ projectId, organizationId, onToast }) => {
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<ProjectHealthDetail | null>(null);
  const [strategies, setStrategies] = useState<HealthStrategy[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [dora, setDora] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [deptMetrics, setDeptMetrics] = useState<Record<string, DepartmentMetrics | null>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoaded(false);
      setHealth(null);
      const [h, s, t, d, act, dep] = await Promise.all([
        getProjectHealth(projectId),
        getHealthStrategies(projectId),
        getAnalyticsTrends(projectId, 'health', 56),
        getDoraMetrics(projectId),
        getGitActivity(projectId),
        organizationId ? listDepartments(organizationId) : Promise.resolve([]),
      ]);
      if (!alive) return;
      setHealth(h);
      setStrategies(s);
      setTrend(t);
      setDora(d);
      setActivity(act);
      setDepts(dep);
      setLoaded(true);
      const pairs = await Promise.all(
        dep.slice(0, 4).map((x) => getDepartmentMetrics(x.id).then((m) => [x.id, m] as const))
      );
      if (alive) setDeptMetrics(Object.fromEntries(pairs));
    })();
    return () => {
      alive = false;
    };
  }, [projectId, organizationId]);

  const changeStrategy = async (id: string) => {
    try {
      await setHealthStrategy(projectId, id);
      onToast(`Health strategy set to ${id}`);
      setHealth(await getProjectHealth(projectId));
    } catch (err: any) {
      onToast(err?.msg || 'Failed to update health strategy');
    }
  };

  if (!loaded) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
          <Activity className="w-4 h-4" />
          <span>Analytics</span>
        </div>
        <h1 className="text-lg font-black text-slate-900">No analytics available</h1>
        <p className="text-xs text-slate-600 font-mono mt-0.5">
          The backend did not return a health record for this project.
        </p>
      </div>
    );
  }

  const radarData = Object.entries(health.components).map(([k, v]) => ({ component: k, value: v }));

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <Activity className="w-4 h-4" />
          <span>Analytics — Health {health.score}/100</span>
        </div>
        <label className="flex items-center space-x-2 bg-slate-50 border border-slate-300 px-3 py-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Strategy</span>
          <select
            value={health.evaluationStrategy}
            onChange={(e) => changeStrategy(e.target.value)}
            className="bg-transparent text-[11px] font-mono font-bold uppercase text-slate-800 focus:outline-none"
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
            Health components
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="component" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.35} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
            Health trend (56 days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DORA + activity */}
      {dora && (
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3 flex items-center">
            <GitBranch className="w-4 h-4 text-indigo-600 mr-2" /> Delivery (DORA)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <Tile label="Deploy / wk" value={`${dora.deployFrequencyPerWeek}`} />
            <Tile label="Lead time" value={`${dora.leadTimeHours}h`} />
            <Tile label="Change fail" value={`${Math.round((dora.changeFailureRate || 0) * 100)}%`} />
            <Tile label="MTTR" value={dora.mttrHours == null ? '—' : `${dora.mttrHours}h`} />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="commitCount" name="Commits" fill="#0f172a" />
                <Bar dataKey="prCount" name="PRs" fill="#4f46e5" />
                <Bar dataKey="reviewCount" name="Reviews" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Department metric table */}
      <div className="p-5 bg-white border border-slate-300">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
          Department metrics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">
                <th className="py-1.5 pr-3">Department</th>
                <th className="py-1.5 pr-3">Items</th>
                <th className="py-1.5 pr-3">Completion</th>
                <th className="py-1.5 pr-3">Points</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-700">
              {depts.map((d) => {
                const m = deptMetrics[d.id];
                return (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-bold text-slate-900">{d.name}</td>
                    <td className="py-1.5 pr-3">{m ? m.totalItems : '…'}</td>
                    <td className="py-1.5 pr-3">{m ? `${m.completionRate}%` : '…'}</td>
                    <td className="py-1.5 pr-3">{m ? `${m.completedPoints}/${m.plannedPoints}` : '…'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 bg-slate-50 border border-slate-200 text-center">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
  </div>
);
