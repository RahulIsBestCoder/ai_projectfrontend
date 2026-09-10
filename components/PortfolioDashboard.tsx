'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutGrid,
  ShieldAlert,
  Activity,
  TriangleAlert,
  ArrowUpRight,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Project } from '@/types';
import { listProjects, createProject } from '@/lib/api';

interface PortfolioDashboardProps {
  organizationName: string;
  organizationId?: string;
  ownerId?: string;
  selectedProjectId: string;
  onOpenProject: (id: string) => void;
  onProjectCreated?: () => void;
  onToast?: (m: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'cancelled', label: 'Cancelled' },
];

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
  organizationId,
  ownerId,
  selectedProjectId,
  onOpenProject,
  onProjectCreated,
  onToast,
}) => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => listProjects().then(setProjects);

  useEffect(() => {
    let alive = true;
    listProjects().then((p) => alive && setProjects(p));
    return () => {
      alive = false;
    };
  }, []);

  // The backend's token exchange returns no user object, so `ownerId` is usually
  // empty. Fall back to the org/owner of an existing project (same org, valid
  // user); the modal lets the user paste ids if nothing can be derived.
  const firstWithOwner = (projects ?? []).find((p) => (p as any).ownerId);
  const firstWithOrg = (projects ?? []).find((p) => p.organizationId);
  const seedOrgId = organizationId || (firstWithOrg?.organizationId ?? '');
  const seedOwnerId = ownerId || ((firstWithOwner as any)?.ownerId ?? '');

  if (!projects) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading portfolio…
      </div>
    );
  }

  const avgHealth = Math.round(
    projects.reduce((s, p) => s + p.healthScore, 0) / Math.max(1, projects.length),
  );
  const totalRisks = projects.reduce((s, p) => s + (p.keyRiskFactors?.length || 0), 0);
  const atRisk = projects.filter((p) => p.status !== 'ON_TRACK').length;

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
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
          <button
            onClick={() => setShowCreate(true)}
            title="Create a new project"
            className="shrink-0 flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="p-6 bg-white border border-slate-300 text-xs font-mono text-slate-500">
          No projects yet. Click <span className="text-indigo-700 font-bold">Create Project</span> to add
          the first one.
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

      {showCreate && (
        <CreateProjectModal
          organizationName={organizationName}
          organizationId={seedOrgId}
          ownerId={seedOwnerId}
          onClose={() => setShowCreate(false)}
          onToast={onToast}
          onCreated={async (id) => {
            setShowCreate(false);
            await load();
            onProjectCreated?.();
            if (id) onOpenProject(id);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Create-project modal
// ---------------------------------------------------------------------------

const CreateProjectModal: React.FC<{
  organizationName: string;
  organizationId: string;
  ownerId: string;
  onClose: () => void;
  onCreated: (id?: string) => void;
  onToast?: (m: string) => void;
}> = ({ organizationName, organizationId, ownerId, onClose, onCreated, onToast }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [orgId, setOrgId] = useState(organizationId);
  const [owner, setOwner] = useState(ownerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!orgId.trim() || !owner.trim()) {
      setError('Organisation id and owner id are required by the backend. Paste them below.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        organizationId: orgId.trim(),
        ownerId: owner.trim(),
        status: status as any,
      });
      onToast?.(`Project "${name.trim()}" created.`);
      onCreated(created?.id || created?._id);
    } catch (err: any) {
      setError(err?.msg || err?.message || 'Could not create the project.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-white border-2 border-slate-900 shadow-xl mt-16"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Name *
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App"
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short summary of what this project delivers"
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Organisation id *
              </span>
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                readOnly={Boolean(organizationId)}
                placeholder="Mongo ObjectId"
                className={`w-full border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none ${
                  organizationId ? 'bg-slate-100' : 'bg-slate-50'
                }`}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Owner id *
              </span>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                readOnly={Boolean(ownerId)}
                placeholder="user _id"
                className={`w-full border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none ${
                  ownerId ? 'bg-slate-100' : 'bg-slate-50'
                }`}
              />
            </label>
          </div>
          {!organizationId && !owner && (
            <p className="text-[10px] font-mono text-slate-400">
              The session provides no user id, so these were taken from an existing project.
              Adjust if you need a different owner.
            </p>
          )}
          <p className="text-[10px] font-mono text-slate-400">
            Organisation: <span className="text-slate-600">{organizationName || orgId || '—'}</span>
          </p>

          {error && (
            <p className="text-[11px] font-mono text-rose-600 border border-rose-200 bg-rose-50 px-2.5 py-1.5">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim() || !orgId.trim() || !owner.trim()}
            className="flex items-center space-x-2 px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-widest border border-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{busy ? 'Creating…' : 'Create'}</span>
          </button>
        </div>
      </form>
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
