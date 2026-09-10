'use client';

import React, { useEffect, useState } from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Building2, Loader2, Activity, ListChecks, Target } from 'lucide-react';
import { Department, DepartmentMetrics } from '@/types';
import { listDepartments, getDepartmentMetrics } from '@/lib/api';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#cbd5e1',
  borderRadius: '0px',
  color: '#0f172a',
  fontSize: '11px',
  fontFamily: 'monospace',
};

const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
const STATUS_FILL: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#4f46e5',
  blocked: '#e11d48',
  done: '#059669',
  cancelled: '#cbd5e1',
};

function deptHealth(m: DepartmentMetrics): number {
  const pointsRatio = m.completedPoints / Math.max(1, m.plannedPoints);
  const blockedRatio = (m.statusBreakdown.blocked || 0) / Math.max(1, m.totalItems);
  const raw = 0.5 * m.completionRate + 0.5 * pointsRatio * 100 - 40 * blockedRatio;
  return Math.max(5, Math.min(100, Math.round(raw)));
}

function band(score: number) {
  if (score >= 75) return { fill: '#059669', text: 'text-emerald-700', label: 'Healthy' };
  if (score >= 50) return { fill: '#d97706', text: 'text-amber-700', label: 'Watch' };
  return { fill: '#e11d48', text: 'text-rose-700', label: 'Critical' };
}

const Gauge: React.FC<{ score: number }> = ({ score }) => {
  const b = band(score);
  return (
    <div className="relative w-20 h-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={[{ value: score, fill: b.fill }]}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-black ${b.text}`}>{score}</span>
      </div>
    </div>
  );
};

interface Row {
  dept: Department;
  metrics: DepartmentMetrics;
  health: number;
}

export const DepartmentHealth: React.FC<{ organizationId?: string }> = ({
  organizationId = '',
}) => {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRows(null);
      const depts = await listDepartments(organizationId);
      const metrics = await Promise.all(depts.map((d) => getDepartmentMetrics(d.id)));
      if (!alive) return;
      setRows(
        depts
          .map((dept, i) => ({ dept, metrics: metrics[i] }))
          .filter((x): x is { dept: Department; metrics: DepartmentMetrics } => x.metrics != null)
          .map(({ dept, metrics }) => ({ dept, metrics, health: deptHealth(metrics) }))
      );
    })();
    return () => {
      alive = false;
    };
  }, [organizationId]);

  if (!rows) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading department health…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
            <Building2 className="w-4 h-4" />
            <span>Department Health</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">No department data</h1>
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            The backend returned no departments or metrics for this organisation. Create departments in
            Administration and assign users to them.
          </p>
        </div>
      </div>
    );
  }

  const totalItems = rows.reduce((s, r) => s + r.metrics.totalItems, 0);
  const avgCompletion = Math.round(
    rows.reduce((s, r) => s + r.metrics.completionRate, 0) / Math.max(1, rows.length)
  );
  const plannedPoints = rows.reduce((s, r) => s + r.metrics.plannedPoints, 0);
  const completedPoints = rows.reduce((s, r) => s + r.metrics.completedPoints, 0);
  const avgHealth = Math.round(rows.reduce((s, r) => s + r.health, 0) / Math.max(1, rows.length));

  const compareData = rows.map((r) => ({
    name: r.dept.name.length > 14 ? r.dept.name.slice(0, 12) + '…' : r.dept.name,
    completion: r.metrics.completionRate,
    health: r.health,
  }));

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
          <Building2 className="w-4 h-4" />
          <span>Department Health</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workforce delivery by department</h1>
        <p className="text-xs text-slate-600 font-mono mt-0.5">
          Work-item-derived metrics from <code className="text-indigo-700">/v1/departments/:id/metrics</code> — department-level
          only, no per-employee data.
        </p>
      </div>

      {/* Aggregate strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Activity} label="Average health" value={`${avgHealth}`} suffix="/ 100" tone={band(avgHealth).text} />
        <Stat icon={Target} label="Average completion" value={`${avgCompletion}%`} />
        <Stat icon={ListChecks} label="Work items" value={`${totalItems}`} />
        <Stat icon={Target} label="Points delivered" value={`${completedPoints}`} suffix={`/ ${plannedPoints}`} />
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(({ dept, metrics, health }) => {
          const b = band(health);
          const bd = STATUS_ORDER.filter((k) => metrics.statusBreakdown[k] != null).map((k) => ({
            key: k,
            value: metrics.statusBreakdown[k],
          }));
          return (
            <div key={dept.id} className="p-5 bg-white border-2 border-slate-200 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">{dept.name}</h3>
                  {dept.description && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 line-clamp-2">{dept.description}</p>
                  )}
                  <span
                    className={`inline-block mt-2 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${
                      health >= 75
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : health >= 50
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {b.label}
                  </span>
                </div>
                <Gauge score={health} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Mini label="Items" value={`${metrics.totalItems}`} />
                <Mini label="Completion" value={`${metrics.completionRate}%`} />
                <Mini label="Points" value={`${metrics.completedPoints}/${metrics.plannedPoints}`} />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status breakdown</span>
                <div className="mt-1.5 flex h-3 w-full overflow-hidden border border-slate-200">
                  {bd.map((s) => {
                    const pct = (s.value / Math.max(1, metrics.totalItems)) * 100;
                    return (
                      <div
                        key={s.key}
                        title={`${s.key}: ${s.value}`}
                        style={{ width: `${pct}%`, backgroundColor: STATUS_FILL[s.key] || '#cbd5e1' }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {bd.map((s) => (
                    <span key={s.key} className="inline-flex items-center text-[10px] font-mono text-slate-500">
                      <span
                        className="w-2 h-2 mr-1 inline-block"
                        style={{ backgroundColor: STATUS_FILL[s.key] || '#cbd5e1' }}
                      />
                      {s.key} {s.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison chart */}
      <div className="p-6 bg-white border border-slate-300">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
          Department comparison
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="health" name="Health" fill="#0f172a" />
              <Bar dataKey="completion" name="Completion %" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}> = ({ icon: Icon, label, value, suffix, tone = 'text-slate-900' }) => (
  <div className="p-5 bg-white border border-slate-300">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <Icon className="w-4 h-4 text-indigo-600" />
    </div>
    <div className="mt-3 flex items-baseline space-x-1.5">
      <span className={`text-3xl font-black ${tone}`}>{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);

const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2.5 bg-slate-50 border border-slate-200 text-center">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className="text-sm font-black text-slate-900 mt-1">{value}</div>
  </div>
);
