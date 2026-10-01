'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Building2, Loader2, Users, GitCommit, Activity, X, RotateCcw, ArrowUpRight } from 'lucide-react';
import { Collapsible } from '@shared/components/Collapsible';
import {
  RepoDepartment,
  RepoDepartmentEmployee,
  RepoDepartmentMetrics,
  RepoDepartmentsResponse,
  getRepositoryDepartmentMetrics,
  getRepositoryDepartments,
  setQaReporterRole,
} from '@core/services';

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#cbd5e1',
  borderRadius: '0px',
  color: '#0f172a',
  fontSize: '11px',
  fontFamily: 'monospace',
};

const errorText = (err: any, fallback: string) => err?.msg || err?.message || fallback;

const initials = (name: string) =>
  name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';

const timeAgo = (iso: string | null) => {
  if (!iso) return '—';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 60) return minutes < 1 ? 'just now' : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 60 ? `${days}d ago` : new Date(iso).toLocaleDateString();
};

const lines = (additions: number, deletions: number) => (
  <span className="font-mono whitespace-nowrap">
    <span className="text-emerald-700">+{additions.toLocaleString()}</span>
    {' / '}
    <span className="text-rose-700">−{deletions.toLocaleString()}</span>
  </span>
);

interface DepartmentHealthProps {
  organizationId?: string;
  /** Selected project — required by the backend for department data. */
  projectId?: string;
  /** Opens the screen where a repository's team type can be set. */
  onOpenRepositorySettings?: () => void;
}

/** Departments = repository types (UI, Backend, Apps, Shared, Other); employees = commit authors. */
export const DepartmentHealth: React.FC<DepartmentHealthProps> = ({
  organizationId = '',
  projectId = '',
  onOpenRepositorySettings,
}) => {
  const [data, setData] = useState<RepoDepartmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RepoDepartment | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const next = await getRepositoryDepartments(organizationId, projectId);
      setData(next);
      setSelected(current => current ? next.rows.find(dept => dept.id === current.id) ?? null : null);
      setError(null);
    } catch (err) {
      // Keep any rendered data; show an inline error with Retry.
      setError(errorText(err, 'Could not load departments.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Departments are per project: drop the previous project's data before loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setSelected(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, projectId]);

  // employee.id → department names, for the "Also in" hint.
  const departmentsByEmployee = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const dept of data?.rows ?? []) {
      for (const employee of dept.employees) {
        map.set(employee.id, [...(map.get(employee.id) ?? []), { id: dept.id, name: dept.name }]);
      }
    }
    return map;
  }, [data]);

  const alsoIn = (employeeId: string, departmentId: string) =>
    (departmentsByEmployee.get(employeeId) ?? []).filter((d) => d.id !== departmentId).map((d) => d.name);

  const header = (
    <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
      <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
        <Building2 className="w-4 h-4" />
        <span>Departments</span>
      </div>
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">Workforce by repository type</h1>
      <p className="text-xs text-slate-600 font-mono mt-0.5">
        People are grouped by the type of repository they committed to (UI Team, Backend, Apps, Shared, Other).
      </p>
    </div>
  );

  if (!projectId) {
    return (
      <div className="space-y-6">
        {header}
        <div className="p-6 bg-white border border-slate-300">
          <p className="text-sm font-black text-slate-900">No project selected.</p>
          <p className="text-xs font-mono text-slate-600 mt-1">
            Select a project in the header to see who works on its repositories.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        {error ? (
          <InlineError message={error} onRetry={() => void load()} />
        ) : (
          <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
            <ThemedLoader label="Loading departments" />
          </div>
        )}
      </div>
    );
  }

  const totalCommits = data.rows.reduce((sum, dept) => sum + dept.commit_count, 0);
  const activeTotal = data.rows.reduce((sum, dept) => sum + dept.active_count, 0);

  return (
    <div className="space-y-6">
      {header}
      {error && <InlineError message={error} onRetry={() => void load()} />}

      {data.rows.length === 0 ? (
        <div className="p-6 bg-white border border-slate-300">
          <p className="text-sm font-black text-slate-900">No commit data yet.</p>
          <p className="text-xs font-mono text-slate-600 mt-1">Connect a GitHub repository and run AI Sync.</p>
        </div>
      ) : (
        <>
          <Collapsible title="Summary" defaultOpen subtitle={loading ? 'Refreshing…' : undefined} bodyClassName="">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat icon={Users} label="Total employees" value={`${data.total_employees}`} />
              <Stat icon={Building2} label="Departments" value={`${data.count}`} />
              <Stat icon={GitCommit} label="Total commits" value={totalCommits.toLocaleString()} />
              <Stat
                icon={Activity}
                label={`Active in last ${data.active_window_days} days`}
                value={`${activeTotal}`}
                tone={activeTotal ? 'text-emerald-700' : 'text-slate-400'}
              />
            </div>
            {data.unlinked_repository_count > 0 && (
              <p className="mt-3 text-[10px] font-mono text-slate-500">
                {data.unlinked_repository_count} repositories without a type are grouped under Other.
              </p>
            )}
          </Collapsible>

          <Collapsible title="Departments" defaultOpen subtitle={`${data.rows.length}`} bodyClassName="">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.rows.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  dept={dept}
                  projectId={projectId}
                  onRoleSaved={load}
                  alsoIn={(employeeId) => alsoIn(employeeId, dept.id)}
                  onView={() => setSelected(dept)}
                  onOpenRepositorySettings={onOpenRepositorySettings}
                />
              ))}
            </div>
          </Collapsible>
        </>
      )}

      {selected && (
        <DepartmentDetail
          dept={selected}
          organizationId={organizationId}
          projectId={projectId}
          alsoIn={(employeeId) => alsoIn(employeeId, selected.id)}
          onClose={() => setSelected(null)}
          onRoleSaved={load}
        />
      )}
    </div>
  );
};

const DepartmentCard: React.FC<{
  projectId:string;
  onRoleSaved:()=>Promise<void>;
  dept: RepoDepartment;
  alsoIn: (employeeId: string) => string[];
  onView: () => void;
  onOpenRepositorySettings?: () => void;
}> = ({ dept, projectId, onRoleSaved, alsoIn, onView, onOpenRepositorySettings }) => (
  <div className="p-5 bg-white border-2 border-slate-200 flex flex-col gap-4" style={{ borderTopColor: dept.color, borderTopWidth: 4 }}>
    <div className="min-w-0">
      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} aria-hidden />
        <span className="truncate">{dept.name}</span>
      </h3>
      {dept.description && <p className="text-[11px] text-slate-500 font-mono mt-0.5 line-clamp-2">{dept.description}</p>}
      {dept.id === 'other' && (
        <p className="text-[10px] font-mono text-slate-500 mt-1">
          Repositories without a team type.
          {onOpenRepositorySettings && (
            <button type="button" onClick={onOpenRepositorySettings} className="ml-1 text-indigo-700 font-bold uppercase">
              Set type
            </button>
          )}
        </p>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Mini label="Members" value={`${dept.member_count}`} />
      <Mini
        label="Active"
        value={`${dept.active_count} active`}
        tone={dept.active_count ? 'text-emerald-700' : 'text-slate-400'}
      />
      <Mini label={dept.id==='testing'?'Tasks created':'Commits'} value={(dept.id==='testing'?dept.tasks?.created??0:dept.commit_count).toLocaleString()} />
      <div className="p-2.5 bg-slate-50 border border-slate-200 text-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{dept.id==='testing'?'Tasks closed':'Lines'}</span>
        <div className="text-[11px] font-black mt-1">{dept.id==='testing'?(dept.tasks?.closed??0).toLocaleString():lines(dept.additions, dept.deletions)}</div>
      </div>
    </div>

    <RepositoryChips repositories={dept.repositories} />

    {dept.id==='testing'?<QaReporters employees={dept.employees} projectId={projectId} onSaved={onRoleSaved}/>:<div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top contributors</span>
      <ul className="mt-1.5 space-y-1.5">
        {dept.employees.slice(0, 5).map((employee) => {
          const others = alsoIn(employee.id);
          return (
            <li key={employee.id} className="flex items-center gap-2 min-w-0">
              <Avatar name={employee.name} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-900 truncate">{employee.name}</p>
                {others.length > 0 && <p className="text-[9px] font-mono text-slate-400 truncate">Also in: {others.join(', ')}</p>}
              </div>
              <span className="text-[10px] font-mono text-slate-600 shrink-0">{employee.commits}</span>
              <ActiveDot active={employee.active} />
            </li>
          );
        })}
      </ul>
    </div>}

    <button
      type="button"
      onClick={onView}
      className="self-start inline-flex items-center text-[10px] text-indigo-600 font-bold uppercase"
    >
      View department <ArrowUpRight className="w-3 h-3 ml-0.5" />
    </button>
  </div>
);

type SortKey = 'name' | 'commits' | 'lines' | 'last_commit_at';

const DepartmentDetail: React.FC<{
  dept: RepoDepartment;
  organizationId: string;
  projectId: string;
  alsoIn: (employeeId: string) => string[];
  onClose: () => void;
  onRoleSaved:()=>Promise<void>;
}> = ({ dept, organizationId, projectId, alsoIn, onClose, onRoleSaved }) => {
  const [metrics, setMetrics] = useState<RepoDepartmentMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'commits', dir: 'desc' });

  const load = async () => {
    try {
      setMetrics(await getRepositoryDepartmentMetrics(dept.id, organizationId, projectId));
      setError(null);
      setNotFound(false);
    } catch (err) {
      const message = errorText(err, 'Could not load department details.');
      if (/department not found/i.test(message)) setNotFound(true);
      else setError(message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept.id, organizationId, projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const employees = useMemo(() => {
    const rows = [...(metrics?.employees ?? [])];
    const value = (e: RepoDepartmentEmployee): string | number => {
      if (sort.key === 'name') return e.name.toLowerCase();
      if (sort.key === 'lines') return e.additions + e.deletions;
      if (sort.key === 'last_commit_at') return e.last_commit_at ? new Date(e.last_commit_at).getTime() : 0;
      return e.commits;
    };
    rows.sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [metrics, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }));

  const workData = Object.entries(metrics?.work_items.by_status ?? {}).map(([status, v]) => ({
    status: status.replace(/_/g, ' '),
    count: v.count,
    points: v.points,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${metrics?.name || dept.name} department`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-full overflow-y-auto bg-slate-50 border-l-2 border-slate-900 shadow-xl"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-300 px-5 py-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} aria-hidden />
            <span className="truncate">{metrics?.name || dept.name}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Close department" className="text-slate-500 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {notFound ? (
            <div className="p-6 bg-white border border-slate-300">
              <p className="text-sm font-black text-slate-900">This department has no contributors.</p>
              <button type="button" onClick={onClose} className="mt-2 text-[10px] font-bold uppercase text-indigo-700">
                Back to departments
              </button>
            </div>
          ) : !metrics ? (
            error ? (
              <InlineError message={error} onRetry={() => void load()} />
            ) : (
              <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
                <ThemedLoader label="Loading department" />
              </div>
            )
          ) : (
            <>
              {error && <InlineError message={error} onRetry={() => void load()} />}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Mini label="Headcount" value={`${metrics.headcount}`} />
                <Mini label="Active" value={`${metrics.active_count} active`} tone={metrics.active_count ? 'text-emerald-700' : 'text-slate-400'} />
                <Mini label={dept.id==='testing'?'Tasks created':'Commits'} value={(dept.id==='testing'?metrics.tasks?.created??0:metrics.commits.total).toLocaleString()} />
                <Mini label="Projects" value={`${metrics.projects.count}`} />
                <Mini label={dept.id==='testing'?'Tasks closed':'Work items'} value={dept.id==='testing'?String(metrics.tasks?.closed??0):`${metrics.work_items.total} · ${metrics.work_items.total_points} pts`} />
              </div>

              {dept.id==='testing'?<QaReporters employees={metrics.employees} projectId={projectId} onSaved={async()=>{await load();await onRoleSaved();}}/>:<section className="bg-white border border-slate-300">
                <h3 className="px-4 pt-4 text-xs font-black uppercase tracking-widest text-slate-900">Employees</h3>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">
                        <SortHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                        <th className="py-1.5 pr-3">Email</th>
                        <th className="py-1.5 pr-3">Role</th>
                        <SortHeader label="Commits" sortKey="commits" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Lines" sortKey="lines" sort={sort} onSort={toggleSort} />
                        <SortHeader label="Last commit" sortKey="last_commit_at" sort={sort} onSort={toggleSort} />
                        <th className="py-1.5 pr-3">Status</th>
                        <th className="py-1.5 pr-3">Projects</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {employees.map((employee) => {
                        const others = alsoIn(employee.id);
                        return (
                          <tr key={employee.id} className="border-t border-slate-100 align-top">
                            <td className="py-2 pr-3">
                              <div className="flex items-start gap-2">
                                <Avatar name={employee.name} />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900">{employee.name}</p>
                                  {employee.login && <p className="text-[10px] font-mono text-slate-400">{employee.login}</p>}
                                  {!employee.user_id && <p className="text-[10px] font-mono text-slate-400">Not linked to an account</p>}
                                  {others.length > 0 && <p className="text-[10px] font-mono text-slate-400">Also in: {others.join(', ')}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-3 font-mono" title={employee.emails.length > 1 ? employee.emails.join('\n') : undefined}>
                              {employee.email || '—'}
                              {employee.emails.length > 1 && <span className="ml-1 text-[10px] text-slate-400">+{employee.emails.length - 1}</span>}
                            </td>
                            <td className="py-2 pr-3">{employee.role || '—'}</td>
                            <td className="py-2 pr-3 font-mono font-bold text-slate-900">{employee.commits}</td>
                            <td className="py-2 pr-3">{lines(employee.additions, employee.deletions)}</td>
                            <td className="py-2 pr-3 font-mono whitespace-nowrap">{timeAgo(employee.last_commit_at)}</td>
                            <td className="py-2 pr-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${employee.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                                <ActiveDot active={employee.active} /> {employee.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {employee.projects.map((project) => (
                                  <span key={project.id} className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200">
                                    {project.name || 'Unknown project'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>}

              {dept.id!=='testing'&&<section className="p-4 bg-white border border-slate-300">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-2">Repositories</h3>
                <ul className="space-y-1.5">
                  {metrics.repositories.map((repository) => (
                    <li key={repository.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className={repository.linked ? 'font-bold text-slate-900' : 'text-slate-400'}>
                        {repository.linked ? repository.name : 'Unknown repository'}
                        {repository.project_name && (
                          <span className="ml-2 text-[10px] font-mono text-slate-500">{repository.project_name}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 shrink-0">
                        {repository.name ? `${metrics.teams[repository.name] ?? 0} contributors` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>}

              {metrics.work_items.total > 0 && (
                <section className="p-4 bg-white border border-slate-300">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-2">Work items by status</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="status" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" name="Items" fill="#4f46e5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

const SortHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, sort, onSort }) => {
  const active = sort.key === sortKey;
  return (
    <th className="py-1.5 pr-3" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className="uppercase tracking-widest font-black hover:text-slate-900">
        {label}
        {active && <span aria-hidden> {sort.dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
};

const RepositoryChips: React.FC<{ repositories: RepoDepartment['repositories'] }> = ({ repositories }) =>
  repositories.length ? (
    <div className="flex flex-wrap gap-1">
      {repositories.map((repository) => (
        <span
          key={repository.id}
          title={repository.linked ? repository.project_name ?? undefined : undefined}
          className={`px-1.5 py-0.5 text-[10px] font-mono border ${
            repository.linked ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {repository.linked ? repository.name : 'Unknown repository'}
        </span>
      ))}
    </div>
  ) : null;

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <span className="w-6 h-6 shrink-0 bg-slate-200 text-slate-700 text-[9px] font-black flex items-center justify-center" aria-hidden>
    {initials(name)}
  </span>
);

const ActiveDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-emerald-600' : 'bg-slate-300'}`}
    title={active ? 'Active' : 'Inactive'}
    aria-label={active ? 'Active' : 'Inactive'}
  />
);

const InlineError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="p-4 bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs font-mono text-rose-700">
    <span>{message}</span>
    <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-800">
      <RotateCcw className="w-3 h-3" /> Retry
    </button>
  </div>
);

const Stat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  suffix?: string;
  tone?: string;
}> = ({ icon: Icon, label, value, suffix, tone = 'text-slate-900' }) => (
  <div className="p-5 bg-white border border-slate-300">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <Icon className="w-4 h-4 text-indigo-600 shrink-0" />
    </div>
    <div className="mt-3 flex items-baseline space-x-1.5">
      <span className={`text-3xl font-black ${tone}`}>{value}</span>
      {suffix && <span className="text-[10px] font-mono text-slate-400">{suffix}</span>}
    </div>
  </div>
);

const Mini: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="p-2.5 bg-slate-50 border border-slate-200 text-center">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className={`text-sm font-black mt-1 ${tone}`}>{value}</div>
  </div>
);

function QaReporters({employees,projectId,onSaved}:{employees:RepoDepartmentEmployee[];projectId:string;onSaved:()=>Promise<void>}) {
  return <section className="space-y-3">
    <h3 className="text-xs font-bold text-slate-900">Taiga reporters</h3>
    <p className="text-[11px] text-slate-500">Choose a role for this project. Managers are excluded from QA efficiency. QA closure rate is closed reported tasks/issues divided by total reported tasks/issues; it is not an individual productivity score.</p>
    {employees.map(employee=><QaReporter key={projectId+employee.id} employee={employee} projectId={projectId} onSaved={onSaved}/>)}
  </section>;
}
function QaReporter({employee,projectId,onSaved}:{employee:RepoDepartmentEmployee;projectId:string;onSaved:()=>Promise<void>}) {
  const [role,setRole]=useState<'qa'|'manager'>(employee.reporting_role==='manager'?'manager':'qa');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>setRole(employee.reporting_role==='manager'?'manager':'qa'),[employee.reporting_role]);
  const save=async(next:'qa'|'manager')=>{
    setSaving(true);setError('');
    try { await setQaReporterRole(projectId,employee.id,next);setRole(next);await onSaved(); }
    catch(err){setError(errorText(err,'Could not save role. Try again.'));}
    finally{setSaving(false);}
  };
  return <div className="p-3 border border-slate-200 bg-white space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">{employee.name}</span>
      <label className="text-xs text-slate-600">Reporter role <select aria-label={'Reporter role for '+employee.name} value={role} disabled={saving} onChange={e=>void save(e.target.value as 'qa'|'manager')} className="ml-2 border border-slate-300 p-1 bg-white disabled:opacity-50"><option value="qa">QA</option><option value="manager">Manager</option></select></label>
    </div>
    <p className="text-[11px] text-slate-600">{employee.tasks?.created??0} tasks created · {employee.tasks?.closed??0} tasks closed</p>
    <p className="text-[11px] text-indigo-700">{saving?'Saving…':role==='manager'?'Efficiency excluded — Manager':employee.efficiency?.percent==null?'QA efficiency: no eligible reports':'QA closure rate: '+employee.efficiency.percent+'%'}</p>
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
