'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, Wand2, Save, Plus, Trash2 } from 'lucide-react';
import { Plan, PlanSprint } from '@/types';
import { createPlan, generateSprintDistribution, updatePlan } from '@/lib/api';

export const PlansView: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [name, setName] = useState('MVP delivery plan');
  const [requirements, setRequirements] = useState('');
  const [deadline, setDeadline] = useState('');
  const [featuresText, setFeaturesText] = useState(
    'User authentication\nProject dashboard\nWork item board\nReporting exports\nNotifications'
  );
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sprints, setSprints] = useState<PlanSprint[]>([]);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  const features = featuresText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const create = async () => {
    setCreating(true);
    try {
      const p = await createPlan({ projectId, name, requirements, deadline: deadline || undefined, features });
      setPlan(p);
      setSprints(p.sprintDistribution?.sprints || []);
      onToast('Plan created');
    } catch (err: any) {
      onToast(err?.msg || 'Could not create plan');
    } finally {
      setCreating(false);
    }
  };

  const generate = async () => {
    if (!plan) return;
    setGenerating(true);
    try {
      const dist = await generateSprintDistribution(plan.id);
      setSprints(dist.sprints);
      onToast(`Drafted ${dist.sprints.length} sprints`);
    } catch (err: any) {
      onToast(err?.msg || 'Sprint distribution endpoint unavailable');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!plan) return;
    try {
      await updatePlan(plan.id, { sprintDistribution: { sprints } });
      onToast('Sprint distribution saved to plan');
    } catch (err: any) {
      onToast(err?.msg || 'Save failed');
    }
  };

  const patchSprint = (i: number, patch: Partial<PlanSprint>) =>
    setSprints((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <Sparkles className="w-4 h-4" />
        <span>AI Sprint Planner</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-300 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
            Plan brief
          </h3>
          <L label="Plan name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </L>
          <L label="Deadline">
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </L>
          <L label="Requirements">
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </L>
          <L label="Features (one per line)">
            <textarea
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={6}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </L>
          <button
            onClick={create}
            disabled={creating}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{plan ? 'Recreate plan' : 'Create plan'}</span>
          </button>
        </div>

        <div className="p-5 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
              Sprint distribution
            </h3>
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={!plan || generating}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase tracking-wider border border-indigo-700 disabled:opacity-40"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                <span>Generate</span>
              </button>
              <button
                onClick={save}
                disabled={!plan || !sprints.length}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5 text-indigo-600" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {!plan && (
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-8 text-center">
              Create a plan, then generate a distribution
            </p>
          )}

          {generating && (
            <div className="flex items-center justify-center py-8 text-slate-500 text-xs font-mono uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Gemini is drafting sprints…
            </div>
          )}

          {!generating &&
            sprints.map((s, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => patchSprint(i, { name: e.target.value })}
                    className="flex-1 bg-white border border-slate-300 px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={s.durationDays}
                    onChange={(e) => patchSprint(i, { durationDays: Number(e.target.value) })}
                    className="w-16 bg-white border border-slate-300 px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <span className="text-[10px] font-mono text-slate-400">days</span>
                  <button onClick={() => setSprints((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                </div>
                <input
                  value={s.goal}
                  onChange={(e) => patchSprint(i, { goal: e.target.value })}
                  className="w-full bg-white border border-slate-300 px-2 py-1 text-[11px] font-mono text-slate-700 focus:outline-none"
                />
                <textarea
                  value={s.features.join('\n')}
                  onChange={(e) => patchSprint(i, { features: e.target.value.split('\n').filter(Boolean) })}
                  rows={Math.max(2, s.features.length)}
                  className="w-full bg-white border border-slate-300 px-2 py-1 text-[11px] font-mono text-slate-700 focus:outline-none resize-none"
                />
              </div>
            ))}

          {!generating && plan && sprints.length > 0 && (
            <button
              onClick={() =>
                setSprints((prev) => [...prev, { name: `Sprint ${prev.length + 1}`, goal: '', durationDays: 14, features: [] }])
              }
              className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" /> <span>Add sprint</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const L: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">{label}</span>
    {children}
  </label>
);
