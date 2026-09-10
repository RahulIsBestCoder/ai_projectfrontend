'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Wand2,
  X,
  RefreshCw,
  AlertTriangle,
  Flag,
  CalendarClock,
  ChevronDown,
  History,
} from 'lucide-react';
import {
  GeneratePlanInput,
  GeneratedPlan,
  SavedPlan,
  PlanRisk,
} from '@/types';
import { generatePlan, listPlans, getPlan } from '@/lib/api';

const TODAY = new Date().toISOString().slice(0, 10);

const LOADER_STEPS = [
  'Analyzing requirements',
  'Dividing sprints',
  'Estimating deadlines',
  'Assessing risks',
];

export const PlansView: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  // ---- form state -------------------------------------------------------------
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [sprintLengthWeeks, setSprintLengthWeeks] = useState(2);
  const [startDate, setStartDate] = useState(TODAY);
  const [constraintsText, setConstraintsText] = useState('');

  // ---- request state --------------------------------------------------------
  const [generating, setGenerating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<GeneratedPlan | null>(null);
  const [lastInput, setLastInput] = useState<GeneratePlanInput | null>(null);
  const [history, setHistory] = useState<SavedPlan[]>([]);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const constraints = useMemo(
    () => constraintsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [constraintsText],
  );

  // ---- prior plans for this project ---------------------------------------
  const loadHistory = async () => {
    const rows = await listPlans(projectId);
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    setHistory(rows);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // rotate loader hints while a request is in flight
  useEffect(() => {
    if (!generating) return;
    setStepIdx(0);
    const t = setInterval(() => setStepIdx((i) => (i + 1) % LOADER_STEPS.length), 2500);
    return () => clearInterval(t);
  }, [generating]);

  const buildInput = (): GeneratePlanInput => ({
    description: description.trim(),
    projectName: projectName.trim() || undefined,
    projectId: projectId || undefined,
    teamSize,
    durationWeeks,
    sprintLengthWeeks,
    startDate: startDate || undefined,
    constraints: constraints.length ? constraints : undefined,
  });

  const run = async (input: GeneratePlanInput) => {
    if (!input.description) {
      onToast('Describe the project to plan first.');
      return;
    }
    abortRef.current = new AbortController();
    setGenerating(true);
    setResult(null);
    try {
      const gen = await generatePlan(input, abortRef.current.signal);
      setResult(gen);
      setLastInput(input);
      onToast(
        gen.generatedBy === 'google'
          ? `Plan generated — ${gen.plan.sprints?.length ?? 0} sprints`
          : 'Fallback plan generated (AI provider unavailable)',
      );
      loadHistory();
    } catch (err: any) {
      if (
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        err?.msg === 'canceled' ||
        err?.message === 'canceled'
      ) {
        onToast('Generation cancelled.');
      } else {
        onToast(err?.msg || err?.message || 'Plan generation failed');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const openSaved = async (row: SavedPlan) => {
    // The list row already carries the full plan; fall back to a fetch if not.
    const doc = row.plan ? row : await getPlan(row.id);
    if (!doc) {
      onToast('Could not load that plan.');
      return;
    }
    setResult({
      id: doc.id,
      generatedBy: doc.provider,
      model: doc.model,
      input: doc.input,
      plan: doc.plan,
    });
    setLastInput(doc.input ?? null);
  };

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <Sparkles className="w-4 h-4" />
        <span>AI Sprint Planner</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* -------------------------------------------------- brief form ---- */}
        <div className="p-5 bg-white border border-slate-300 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
            Plan brief
          </h3>

          <L label="Project description *">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What must this project deliver? The more detail, the better the plan."
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </L>

          <L label="Project name">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Derived from the description if left blank"
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </L>

          <div className="grid grid-cols-3 gap-2">
            <L label="Team size">
              <NumberInput value={teamSize} min={1} onChange={setTeamSize} />
            </L>
            <L label="Duration (wk)">
              <NumberInput value={durationWeeks} min={1} onChange={setDurationWeeks} />
            </L>
            <L label="Sprint (wk)">
              <NumberInput value={sprintLengthWeeks} min={1} onChange={setSprintLengthWeeks} />
            </L>
          </div>

          <L label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </L>

          <L label="Constraints (one per line)">
            <textarea
              value={constraintsText}
              onChange={(e) => setConstraintsText(e.target.value)}
              rows={3}
              placeholder={'must use React\nfixed go-live 20 Dec\nno new hires'}
              className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none resize-none"
            />
          </L>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => run(buildInput())}
              disabled={generating || !description.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              <span>{generating ? 'Generating…' : 'Generate plan'}</span>
            </button>
            {generating && (
              <button
                onClick={cancel}
                className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {generating && (
            <div className="mt-2 border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center space-x-2 text-[11px] font-mono uppercase tracking-widest text-slate-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>{LOADER_STEPS[stepIdx]}…</span>
              </div>
              <div className="mt-2 h-1 w-full bg-slate-200 overflow-hidden">
                <div className="h-full w-1/3 bg-indigo-600 animate-pulse" />
              </div>
              <p className="mt-2 text-[10px] font-mono text-slate-400">
                AI generation can take up to ~90s. Safe to leave this tab open.
              </p>
            </div>
          )}

          {/* ----------------------------------------- prior plans -------- */}
          {history.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                <History className="w-3 h-3" />
                <span>Previous plans</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => openSaved(row)}
                    className="w-full flex items-center justify-between px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-left"
                  >
                    <span className="truncate text-[11px] font-mono text-slate-700">
                      {row.title || row.plan?.planName || 'Untitled plan'}
                    </span>
                    <span className="shrink-0 ml-2 flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-slate-400">
                        {(row.createdAt || '').slice(0, 10)}
                      </span>
                      <ProviderBadge provider={row.provider} compact />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------------------- result ------- */}
        <div className="p-5 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
              Generated plan
            </h3>
            {result && (
              <div className="flex gap-2">
                <button
                  onClick={() => lastInput && run(lastInput)}
                  disabled={generating || !lastInput}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Regenerate</span>
                </button>
                <button
                  disabled
                  title="Pending backend: POST /v1/plans/:id/apply"
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white text-slate-400 text-[11px] font-bold uppercase tracking-wider border border-slate-200 cursor-not-allowed"
                >
                  <span>Apply to project</span>
                </button>
              </div>
            )}
          </div>

          {!result && !generating && (
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-10 text-center">
              Fill the brief, then generate a plan
            </p>
          )}

          {generating && (
            <div className="flex items-center justify-center py-10 text-slate-500 text-xs font-mono uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {LOADER_STEPS[stepIdx]}…
            </div>
          )}

          {result && !generating && <PlanReport gen={result} />}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Result renderer
// ---------------------------------------------------------------------------

const PlanReport: React.FC<{ gen: GeneratedPlan }> = ({ gen }) => {
  const { plan } = gen;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm font-black text-slate-900">{plan.planName}</span>
          <ProviderBadge provider={gen.generatedBy} />
          {gen.model && (
            <span className="text-[9px] font-mono text-slate-400 uppercase">{gen.model}</span>
          )}
        </div>
        {plan.summary && (
          <p className="text-[11px] font-mono text-slate-600 leading-relaxed">{plan.summary}</p>
        )}
        {plan.totalDurationWeeks != null && (
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            {plan.totalDurationWeeks} weeks · {plan.sprints?.length ?? 0} sprints
          </p>
        )}
      </div>

      {/* sprints */}
      <div className="space-y-2">
        {(plan.sprints ?? []).map((s) => (
          <div key={s.index} className="border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 truncate">
                  {s.name}
                </div>
                {s.goal && (
                  <div className="text-[10px] font-mono text-slate-500 truncate">{s.goal}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-mono text-slate-600">
                  {s.startDate} → {s.endDate}
                </div>
                {s.plannedPoints != null && (
                  <div className="text-[9px] font-mono text-indigo-600 uppercase">
                    {s.plannedPoints} pts
                  </div>
                )}
              </div>
            </div>
            {s.tasks?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider">
                      <th className="text-left font-bold px-3 py-1">Task</th>
                      <th className="text-left font-bold px-2 py-1">Role</th>
                      <th className="text-left font-bold px-2 py-1">Priority</th>
                      <th className="text-right font-bold px-2 py-1">Pts</th>
                      <th className="text-right font-bold px-3 py-1">Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.tasks.map((t, i) => (
                      <tr key={i} className="border-t border-slate-100 text-slate-700">
                        <td className="px-3 py-1">{t.title}</td>
                        <td className="px-2 py-1 text-slate-500">{t.assigneeRole || '—'}</td>
                        <td className="px-2 py-1">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="px-2 py-1 text-right">{t.storyPoints ?? '—'}</td>
                        <td className="px-3 py-1 text-right">{t.estimateHours ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* milestones */}
      {plan.milestones && plan.milestones.length > 0 && (
        <Block icon={Flag} title="Milestones">
          <ul className="space-y-1">
            {plan.milestones.map((m, i) => (
              <li key={i} className="flex items-baseline justify-between text-[11px] font-mono">
                <span className="text-slate-700">{m.name}</span>
                <span className="text-slate-400">{m.date || '—'}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* deadlines */}
      {plan.deadlines && plan.deadlines.length > 0 && (
        <Block icon={CalendarClock} title="Deadlines">
          <ul className="space-y-1">
            {[...plan.deadlines]
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              .map((d, i) => (
                <li key={i} className="flex items-baseline justify-between text-[11px] font-mono">
                  <span className="text-slate-700">{d.label}</span>
                  <span className="text-slate-400">{d.date || '—'}</span>
                </li>
              ))}
          </ul>
        </Block>
      )}

      {/* risks */}
      {plan.risks && plan.risks.length > 0 && (
        <Block icon={AlertTriangle} title="Risks">
          <div className="space-y-2">
            {plan.risks.map((r, i) => (
              <RiskCard key={i} risk={r} />
            ))}
          </div>
        </Block>
      )}

      {/* assumptions */}
      {plan.assumptions && plan.assumptions.length > 0 && (
        <details className="border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="flex items-center space-x-1.5 cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ChevronDown className="w-3 h-3" />
            <span>Assumptions ({plan.assumptions.length})</span>
          </summary>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            {plan.assumptions.map((a, i) => (
              <li key={i} className="text-[11px] font-mono text-slate-600">
                {a}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

const L: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
      {label}
    </span>
    {children}
  </label>
);

const NumberInput: React.FC<{ value: number; min?: number; onChange: (n: number) => void }> = ({
  value,
  min = 0,
  onChange,
}) => (
  <input
    type="number"
    min={min}
    value={Number.isFinite(value) ? value : ''}
    onChange={(e) => {
      const n = Number(e.target.value);
      onChange(Number.isFinite(n) && n >= min ? n : min);
    }}
    className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
  />
);

const Block: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  children,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
      <Icon className="w-3 h-3" />
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const ProviderBadge: React.FC<{ provider?: string; compact?: boolean }> = ({ provider, compact }) => {
  const fallback = provider === 'heuristic-fallback' || provider === 'rule-based';
  const label = fallback ? 'Fallback' : 'AI generated';
  const cls = fallback
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-emerald-100 text-emerald-800 border-emerald-300';
  return (
    <span
      className={`text-[9px] font-mono font-bold uppercase border px-1.5 ${cls} ${
        compact ? 'py-0' : 'py-0.5'
      }`}
    >
      {compact ? (fallback ? 'FB' : 'AI') : label}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
  const p = (priority || '').toLowerCase();
  const cls =
    p === 'critical' || p === 'urgent'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : p === 'high'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : p === 'medium'
          ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
          : 'bg-slate-100 text-slate-700 border-slate-300';
  return (
    <span className={`text-[9px] font-mono font-bold uppercase border px-1.5 py-0 ${cls}`}>
      {p || '—'}
    </span>
  );
};

const RiskCard: React.FC<{ risk: PlanRisk }> = ({ risk }) => {
  const sev = (risk.severity || '').toLowerCase();
  const bar =
    sev === 'high' || sev === 'critical'
      ? 'border-l-rose-500'
      : sev === 'medium'
        ? 'border-l-amber-500'
        : 'border-l-slate-400';
  return (
    <div className={`border border-slate-200 border-l-4 ${bar} bg-white px-3 py-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-800">{risk.description}</span>
        {risk.severity && (
          <span className="text-[9px] font-mono font-bold uppercase text-slate-500">
            {risk.severity}
          </span>
        )}
      </div>
      {risk.mitigation && (
        <p className="mt-1 text-[10px] font-mono text-slate-500">↳ {risk.mitigation}</p>
      )}
    </div>
  );
};
