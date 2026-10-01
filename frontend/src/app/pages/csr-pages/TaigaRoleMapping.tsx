'use client';

import React, { useState } from 'react';
import { Save, Loader2, Check } from 'lucide-react';

interface TaigaUser {
  id: number;
  username: string;
  fullName?: string;
}

interface Mapping {
  role: string;
  taigaUserId: number | null;
}

interface TaigaRoleMappingProps {
  integrationId: string;
  users: TaigaUser[];
  initialMappings: Mapping[];
  onSave: (role: string, taigaUserId: number) => Promise<void>;
}

const DEFAULT_ROLES = ['backend', 'frontend', 'app', 'qa', 'design', 'devops'];

export const TaigaRoleMapping: React.FC<TaigaRoleMappingProps> = ({
  users,
  initialMappings,
  onSave,
}) => {
  const [mappings, setMappings] = useState<Mapping[]>(() => {
    const existing = new Map(initialMappings.map((m) => [m.role, m.taigaUserId]));
    return DEFAULT_ROLES.map((role) => ({ role, taigaUserId: existing.get(role) ?? null }));
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMapping = (role: string, taigaUserId: number | null) => {
    setMappings((prev) => prev.map((m) => (m.role === role ? { ...m, taigaUserId } : m)));
    setSaved(null);
  };

  const handleSave = async (role: string) => {
    const mapping = mappings.find((m) => m.role === role);
    if (!mapping?.taigaUserId) return;
    setSaving(role);
    setError(null);
    setSaved(null);
    try {
      await onSave(role, mapping.taigaUserId);
      setSaved(role);
    } catch (err: any) {
      setError(err?.msg || `Failed to save mapping for ${role}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
        <span>Role → Taiga User Mapping</span>
      </div>
      <p className="text-[10px] text-slate-500 font-mono">
        Map each project role to a Taiga user so tasks can be assigned on publish.
      </p>

      {error && (
        <div className="p-2 bg-rose-50 border border-rose-300 text-[10px] font-mono text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {mappings.map((mapping) => (
          <div
            key={mapping.role}
            className="flex items-center justify-between p-2.5 bg-white border border-slate-200"
          >
            <span className="text-[11px] font-mono font-bold uppercase text-slate-700 w-24">
              {mapping.role}
            </span>
            <div className="flex items-center space-x-2 flex-1 ml-3">
              <select
                value={mapping.taigaUserId ?? ''}
                onChange={(e) =>
                  updateMapping(mapping.role, e.target.value ? Number(e.target.value) : null)
                }
                className="flex-1 bg-slate-50 border border-slate-300 px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Select Taiga user —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}{u.fullName ? ` (${u.fullName})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleSave(mapping.role)}
                disabled={!mapping.taigaUserId || saving === mapping.role}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                title="Save mapping"
              >
                {saving === mapping.role ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saved === mapping.role ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
