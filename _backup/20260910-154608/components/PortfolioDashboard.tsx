'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutGrid,
  ShieldAlert,
  Activity,
  TriangleAlert,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Project } from '@/types';
import { listProjects } from '@/lib/api';

interface PortfolioDashboardProps {
  organizationName: string;
  selectedProjectId: string;
  onOpenProject: (id: string) => void;
}

function band(score: number) {
  if (score >= 75) return { fill: '#059669', text: 'text-emerald-700', label: 'Healthy' };
  if (score >= 50) return { fill: '#d97706', text: 'text-amber-700', label: 'Watch' };
  return { fill: '#e11d48', text: 'text-rose-700', label: 'Critical' };
}

const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
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

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  organizationName,
  selectedProjectId,
  onOpenProject,
}) => {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let alive = true;
    listProjects().then((p) => alive && setProjects(p));
    return () => {
      alive = false;
    };
  }, []);

  if (!projects) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading portfolio…
      </div>
    );
  }

  const avgHealth = Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / Math.max(1, projects.length));
  const totalRisks = projects.reduce((s, p) => s + (p.keyRiskFactors?.length || 0), 0);
  const atRisk = projects.filter((p) => p.status !== 'ON_TRACK').length;

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
          <LayoutGrid className="w-4 h-4" />
          <span>Organisation Portfolio</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {organizationName || 'Organisation'}
        </h1>
        <p className="text-xs text-slate-600 font-mono mt-0.5">
          {projects.length} projects • cross-project health, progress and delivery risk
        </p>
      </div>

      {projects.length === 0 && (
        <div className="p-6 bg-white border border-slate-300 text-xs font-mono text-slate-500">
          The backend returned no projects. Once <code className="text-indigo-700">GET /v1/projects</code> is
          available (or you create a project), cards will appear here.
        </div>
      )}

      {/* Portfolio strip */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat icon={Activity} label="Average health" value={`${avgHealth}`} suffix="/ 100" tone={band(avgHealth).text} />
          <Stat icon={ShieldAlert} label="Open risk factors" value={`${totalRisks}`} tone="text-rose-700" />
          <Stat icon={TriangleAlert} label="Projects at risk" value={`${atRisk}`} suffix={`of ${projects.length}`} tone={atRisk ? 'text-amber-700' : 'text-emerald-700'} />
        </div>
      )}

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => {
          const b = band(p.healthScore);
          const isActive = p.id === selectedProjectId;
          return (
            <button
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className={`text-left p-5 bg-white border-2 transition flex flex-col gap-4 ${
                isActive ? 'border-indigo-600 shadow-xs' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">{p.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 line-clamp-2">{p.description}</p>
                </div>
                <HealthGauge score={p.healthScore} />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase mb-1">
                  <span>Delivery status</span>
                  <span
                    className={`px-1.5 py-0.5 border font-bold ${
                      p.status === 'ON_TRACK'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : p.status === 'AT_RISK'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {String(p.status).replace('_', ' ')}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2">
                  <div className={`h-full`} style={{ width: `${p.healthScore}%`, backgroundColor: b.fill }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                <span className="flex items-center">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  {p.keyRiskFactors?.length || 0} risks • {p.delayProbability}% delay
                </span>
                <span className="flex items-center text-indigo-600 font-bold uppercase">
                  Open <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </button>
          );
        })}
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
    <div className="mt-3 flex items-baseline space-x-2">
      <span className={`text-3xl font-black ${tone}`}>{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);
