'use client';

import React, { useEffect, useState } from 'react';
import {
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
import { Activity, GitBranch } from 'lucide-react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { Collapsible } from '@shared/components/Collapsible';
import { ProjectHealthDetail, HealthStrategy, TrendPoint } from '@shared/models';
import {
  getProjectHealth,
  getHealthStrategies,
  setHealthStrategy,
  getAnalyticsTrends,
  getDoraMetrics,
  getGitActivity,
} from '@core/services';

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
}> = ({ projectId, onToast }) => {
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<ProjectHealthDetail | null>(null);
  const [strategies, setStrategies] = useState<HealthStrategy[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [dora, setDora] = useState<any | null>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoaded(false);
      setHealth(null);
      const [h, s, t, d, act] = await Promise.all([
        getProjectHealth(projectId),
        getHealthStrategies(projectId),
        getAnalyticsTrends(projectId, 'health', 56),
        getDoraMetrics(projectId),
        getGitActivity(projectId),
      ]);
      if (!alive) return;
      setHealth(h);
      setStrategies(s);
      setTrend(t);
      setDora(d);
      setActivity(act);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

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
        <ThemedLoader label="Loading analytics" />
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

  // Components arrive keyed by backend label ("Overall Health", "Quality", "Progress", "Velocity").
  const componentEntries = Object.entries(health.components);
  const findComponent = (name: string) =>
    componentEntries.find(([key]) => key.toLowerCase().includes(name))?.[1] ?? null;
  const quality = findComponent('quality');
  const progress = findComponent('progress');
  const velocity = findComponent('velocity');
  // Overall health is derived from the components, so it is the headline score, not one more bar.
  // Velocity is story points, not a percentage, so it is listed separately.
  const componentBars = componentEntries
    .filter((entry): entry is [string, number] => !/overall|health|velocity/i.test(entry[0]) && typeof entry[1] === 'number')
    .map(([label, value]) => ({ label, value }));
  const overallLevel = health.score == null ? null : scoreLevel(health.score);

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <Activity className="w-4 h-4" />
          <span>Analytics — Health {health.score == null ? 'Not enough evidence' : `${health.score}/100`}</span>
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

      <Collapsible title="Health components & trend" defaultOpen bodyClassName="">
      <div className="space-y-4">
      {/* Headline score + three circular indicators */}
      <div className="p-5 bg-white border border-slate-300 flex flex-col md:flex-row md:items-center gap-5">
        <div className="md:w-56 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Overall project health</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-4xl font-black ${overallLevel?.text || 'text-slate-400'}`}>
              {health.score == null ? '—' : Math.round(clampScore(health.score))}
            </span>
            <span className="text-xs font-mono text-slate-400">/100</span>
          </div>
          <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${overallLevel?.badge || 'bg-slate-100 text-slate-500 border-slate-300'}`}>
            {overallLevel?.label || 'Unknown'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1">
          <RingIndicator label="Overall Health" value={health.score} />
          <RingIndicator label="Quality" value={quality} />
          <RingIndicator label="Progress" value={progress} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
            Health components
          </h3>
          {componentBars.length ? (
            <ul className="space-y-3">
              {componentBars.map((bar) => (
                <ScoreBar key={bar.label} label={bar.label} value={bar.value} />
              ))}
            </ul>
          ) : (
            <p className="text-[11px] font-mono text-slate-400 py-6 text-center">No component scores yet.</p>
          )}
          {velocity != null && (
            <p className="mt-3 text-[10px] font-mono text-slate-600">
              Velocity: <span className="font-bold text-slate-900">{velocity}</span> points per sprint (not a percentage score)
            </p>
          )}
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-emerald-600" /> 70–100 High</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-orange-500" /> 40–69 Average</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-rose-600" /> 0–39 Low</span>
          </p>
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
      </div>
      </Collapsible>

      {/* DORA + activity */}
      {dora && (
        <Collapsible title="Delivery (DORA)" icon={GitBranch}>
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
        </Collapsible>
      )}

    </div>
  );
};

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

/** Green 70–100 High, orange 40–69 Average, red 0–39 Low. */
const scoreLevel = (value: number) => {
  const v = clampScore(value);
  if (v >= 70) {
    return { label: 'High', text: 'text-emerald-700', bar: 'bg-emerald-600', stroke: '#059669', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
  if (v >= 40) {
    return { label: 'Average', text: 'text-orange-600', bar: 'bg-orange-500', stroke: '#f97316', badge: 'bg-orange-100 text-orange-800 border-orange-300' };
  }
  return { label: 'Low', text: 'text-rose-700', bar: 'bg-rose-600', stroke: '#e11d48', badge: 'bg-rose-100 text-rose-800 border-rose-300' };
};

const ScoreBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const v = clampScore(value);
  const level = scoreLevel(v);
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-bold text-slate-800">{label}</span>
        <span className={`font-mono font-bold ${level.text}`}>
          {Math.round(v)}% · {level.label}
        </span>
      </div>
      <div
        className="mt-1 h-2.5 w-full bg-slate-200"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v)}
      >
        <div className={`h-full ${level.bar}`} style={{ width: `${v}%` }} />
      </div>
    </li>
  );
};

const RingIndicator: React.FC<{ label: string; value: number | null }> = ({ label, value }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const v = value == null ? null : clampScore(value);
  const level = v == null ? null : scoreLevel(v);
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <svg
        viewBox="0 0 72 72"
        className="w-20 h-20"
        role="img"
        aria-label={v == null ? `${label}: no data` : `${label}: ${Math.round(v)}%, ${level!.label}`}
      >
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        {v != null && (
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={level!.stroke}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - v / 100)}
            transform="rotate(-90 36 36)"
          />
        )}
        <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0f172a">
          {v == null ? '—' : `${Math.round(v)}%`}
        </text>
      </svg>
      <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 truncate max-w-full">{label}</span>
      <span className={`text-[10px] font-mono font-bold uppercase ${level ? level.text : 'text-slate-400'}`}>
        {level ? level.label : 'No data'}
      </span>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 bg-slate-50 border border-slate-200 text-center">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
  </div>
);
