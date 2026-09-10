'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Loader2, Plus, Trash2, Save } from 'lucide-react';
import { Department, DepartmentMetrics, Team, Employee, OrgMember } from '@/types';
import {
  getOrgSettings,
  updateOrgSettings,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  listDepartments,
  createDepartment,
  deleteDepartment,
  getDepartmentMetrics,
  listTeams,
  createTeam,
  deleteTeam,
  listEmployees,
} from '@/lib/api';

type Section = 'settings' | 'members' | 'departments' | 'teams' | 'employees';
const ROLES = ['super_admin', 'org_admin', 'project_manager', 'member', 'viewer'];

/** Run a mutation; surface success/failure through the toast, never throw. */
async function guard(fn: () => Promise<unknown>, onToast: (m: string) => void, okMsg?: string) {
  try {
    await fn();
    if (okMsg) onToast(okMsg);
  } catch (err: any) {
    onToast(err?.msg || err?.message || 'Request failed');
  }
}

export const AdminView: React.FC<{ organizationId: string; onToast: (m: string) => void }> = ({
  organizationId,
  onToast,
}) => {
  const [section, setSection] = useState<Section>('settings');

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <Building2 className="w-4 h-4" />
          <span>Administration</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['settings', 'Org settings'],
              ['members', 'Members'],
              ['departments', 'Departments'],
              ['teams', 'Teams'],
              ['employees', 'Employees'],
            ] as [Section, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSection(k)}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border ${
                section === k ? 'bg-slate-900 text-white border-black' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'settings' && <OrgSettings organizationId={organizationId} onToast={onToast} />}
      {section === 'members' && <MembersPanel organizationId={organizationId} onToast={onToast} />}
      {section === 'departments' && <DepartmentsPanel organizationId={organizationId} onToast={onToast} />}
      {section === 'teams' && <TeamsPanel onToast={onToast} />}
      {section === 'employees' && <EmployeesPanel />}
    </div>
  );
};

// --- Org settings -----------------------------------------------------------

const OrgSettings: React.FC<{ organizationId: string; onToast: (m: string) => void }> = ({
  organizationId,
  onToast,
}) => {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    getOrgSettings(organizationId).then(setSettings);
  }, [organizationId]);

  if (!settings) return <PanelLoader />;

  const save = () =>
    guard(() => updateOrgSettings(organizationId, settings), onToast, 'Organisation settings saved');

  return (
    <div className="p-5 bg-white border border-slate-300 space-y-2">
      {Object.entries(settings).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[220px_1fr] gap-3 items-center">
          <span className="text-[11px] font-mono font-bold text-slate-600">{k}</span>
          <input
            value={v}
            onChange={(e) => setSettings({ ...settings, [k]: e.target.value })}
            className="bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
          />
        </div>
      ))}
      <div className="grid grid-cols-[220px_1fr] gap-3 items-center pt-2 border-t border-slate-200">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="new_setting_key"
          className="bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
        />
        <button
          onClick={() => {
            if (newKey.trim()) {
              setSettings({ ...settings, [newKey]: '' });
              setNewKey('');
            }
          }}
          className="justify-self-start flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-700"
        >
          <Plus className="w-3.5 h-3.5" /> <span>Add key</span>
        </button>
      </div>
      <button
        onClick={save}
        className="mt-2 flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black"
      >
        <Save className="w-4 h-4" /> <span>Save</span>
      </button>
    </div>
  );
};

// --- Members --------------------------------------------------------------

const MembersPanel: React.FC<{ organizationId: string; onToast: (m: string) => void }> = ({
  organizationId,
  onToast,
}) => {
  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  const load = () => listOrgMembers(organizationId).then(setMembers);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  if (!members) return <PanelLoader />;

  const invite = async () => {
    if (!email.trim()) return;
    await guard(() => addOrgMember(organizationId, email, role), onToast, `Invited ${email} as ${role}`);
    setEmail('');
    load();
  };

  return (
    <div className="bg-white border border-slate-300">
      <div className="p-4 border-b border-slate-300 flex flex-wrap gap-2 items-center">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@company.com"
          className="flex-1 min-w-[200px] bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-slate-800"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={invite}
          className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
        >
          Invite
        </button>
      </div>
      {members.map((m) => (
        <div key={m.userId} className="px-4 py-2.5 border-b border-slate-100 last:border-0 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">{m.fullName}</div>
            <div className="text-[10px] font-mono text-slate-400">{m.email}</div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300">
              {m.role}
            </span>
            <button
              onClick={() => guard(() => removeOrgMember(organizationId, m.userId), onToast).then(load)}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Departments --------------------------------------------------------------

const DepartmentsPanel: React.FC<{ organizationId: string; onToast: (m: string) => void }> = ({
  organizationId,
  onToast,
}) => {
  const [depts, setDepts] = useState<Department[] | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DepartmentMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const load = () => listDepartments(organizationId).then(setDepts);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    (async () => {
      setMetricsLoading(true);
      setMetrics(null);
      const m = await getDepartmentMetrics(selected);
      if (alive) {
        setMetrics(m);
        setMetricsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected]);

  if (!depts) return <PanelLoader />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-300">
        <div className="p-4 border-b border-slate-300 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Department name"
            className="flex-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <button
            onClick={async () => {
              if (!name.trim()) return;
              await guard(() => createDepartment({ organizationId, name }), onToast, 'Department created');
              setName('');
              load();
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
          >
            Add
          </button>
        </div>
        {depts.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d.id)}
            className={`w-full text-left px-4 py-2.5 border-b border-slate-100 last:border-0 flex items-center justify-between ${
              selected === d.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="text-xs font-bold text-slate-900">{d.name}</div>
              {d.description && <div className="text-[10px] font-mono text-slate-400">{d.description}</div>}
            </div>
            <Trash2
              className="w-3.5 h-3.5 text-rose-600"
              onClick={(e) => {
                e.stopPropagation();
                guard(() => deleteDepartment(d.id), onToast, 'Department deleted').then(() => {
                  if (selected === d.id) setSelected(null);
                  load();
                });
              }}
            />
          </button>
        ))}
      </div>

      <div className="p-5 bg-white border border-slate-300">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
          Department metrics
        </h3>
        {!selected ? (
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-8 text-center">
            Select a department
          </p>
        ) : metricsLoading ? (
          <PanelLoader />
        ) : !metrics ? (
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-8 text-center">
            No metrics returned for this department
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Mini label="Items" value={`${metrics.totalItems}`} />
              <Mini label="Completion" value={`${metrics.completionRate}%`} />
              <Mini label="Points" value={`${metrics.completedPoints}/${metrics.plannedPoints}`} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status breakdown</span>
              <div className="mt-1.5 space-y-1">
                {Object.entries(metrics.statusBreakdown).map(([k, v]) => {
                  const pct = Math.round((v / Math.max(1, metrics.totalItems)) * 100);
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5">
                        <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Teams --------------------------------------------------------------

const TeamsPanel: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [name, setName] = useState('');

  const load = () => listTeams().then(setTeams);
  useEffect(() => {
    load();
  }, []);

  if (!teams) return <PanelLoader />;

  return (
    <div className="bg-white border border-slate-300">
      <div className="p-4 border-b border-slate-300 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name"
          className="flex-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
        />
        <button
          onClick={async () => {
            if (!name.trim()) return;
            await guard(() => createTeam({ name }), onToast, 'Team created');
            setName('');
            load();
          }}
          className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
        >
          Add
        </button>
      </div>
      {teams.map((t) => (
        <div key={t.id} className="px-4 py-2.5 border-b border-slate-100 last:border-0 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-900">{t.name}</div>
            <div className="text-[10px] font-mono text-slate-400">
              {t.description} • {(t.memberIds || []).length} members
            </div>
          </div>
          <button onClick={() => guard(() => deleteTeam(t.id), onToast, 'Team deleted').then(load)}>
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
          </button>
        </div>
      ))}
    </div>
  );
};

// --- Employees --------------------------------------------------------------

const EmployeesPanel: React.FC = () => {
  const [emps, setEmps] = useState<Employee[] | null>(null);
  useEffect(() => {
    listEmployees().then(setEmps);
  }, []);
  if (!emps) return <PanelLoader />;
  return (
    <div className="bg-white border border-slate-300">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-2.5 border-b border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span>Name</span>
        <span>Designation</span>
        <span>Role</span>
      </div>
      {emps.map((e) => (
        <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 items-center">
          <div>
            <div className="text-xs font-bold text-slate-900">{e.fullName}</div>
            <div className="text-[10px] font-mono text-slate-400">{e.email}</div>
          </div>
          <span className="text-[11px] font-mono text-slate-700">{e.designation}</span>
          <span className="text-[10px] font-mono font-bold uppercase text-slate-600">{e.role}</span>
        </div>
      ))}
    </div>
  );
};

const PanelLoader = () => (
  <div className="p-6 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
  </div>
);

const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2.5 bg-slate-50 border border-slate-200 text-center">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <div className="text-sm font-black text-slate-900 mt-1">{value}</div>
  </div>
);
