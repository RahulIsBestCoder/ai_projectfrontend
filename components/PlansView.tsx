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
  History,
  Check,
  CircleCheck,
  Pencil,
  Trash2,
  Plus,
  Undo2,
  FilePlus2,
} from 'lucide-react';
import {
  GeneratePlanInput,
  GeneratedPlan,
  SavedPlan,
  SprintPlan,
  PlanSprint,
  PlanTask,
  PlanMilestone,
  PlanDeadline,
  PlanRisk,
  AcceptedPlanRecord,
} from '@/types';
import { generatePlan, listPlans, getPlan } from '@/lib/api';
import {
  getAcceptedPlan,
  saveAcceptedPlan,
  clearAcceptedPlan,
  getHiddenPlanIds,
  hidePlanId,
} from '@/lib/acceptedPlan';

const TODAY = new Date().toISOString().slice(0, 10);
const LOADER_STEPS = [
  'Analyzing requirements',
  'Dividing sprints',
  'Estimating deadlines',
  'Assessing risks',
];
const ROLES = ['', 'frontend', 'backend', 'fullstack', 'qa', 'devops', 'design'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const emptyTask = (): PlanTask => ({
  title: '',
  type: 'task',
  priority: 'medium',
  assigneeRole: '',
  storyPoints: undefined,
  estimateHours: undefined,
});

const emptySprint = (index: number): PlanSprint => ({
  index,
  name: `Sprint ${index}`,
  goal: '',
  startDate: '',
  endDate: '',
  deadline: '',
  plannedPoints: undefined,
  tasks: [emptyTask()],
});

const emptyPlan = (): SprintPlan => ({
  planName: '',
  summary: '',
  sprints: [emptySprint(1)],
  milestones: [],
  deadlines: [],
  risks: [],
  assumptions: [],
});

type Mode = 'ai' | 'manual';
type DraftSource = 'ai' | 'manual';

export const PlansView: React.FC<{
  projectId: string;
  projectName?: string;
  onToast: (m: string) => void;
}> = ({ projectId, projectName, onToast }) => {
  const [mode, setMode] = useState<Mode>('ai');

  // ---- AI brief form ------------------------------------------------------
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [sprintLengthWeeks, setSprintLengthWeeks] = useState(2);
  const [startDate, setStartDate] = useState(TODAY);
  const [constraintsText, setConstraintsText] = useState('');

  // ---- request state ---------------------------------------------------
  const [generating, setGenerating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [lastInput, setLastInput] = useState<GeneratePlanInput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- working draft (the editable plan) --------------------------------
  const [draft, setDraft] = useState<SprintPlan | null>(null);
  const [draftSource, setDraftSource] = useState<DraftSource | null>(null);
  const [draftMeta, setDraftMeta] = useState<{ planId?: string; generatedBy?: string; model?: string }>(
    {},
  );
  const [pristine, setPristine] = useState<SprintPlan | null>(null); // last generated, for "reset edits"

  // ---- accepted plan + history ----------------------------------------
  const [accepted, setAccepted] = useState<AcceptedPlanRecord | null>(null);
  const [history, setHistory] = useState<SavedPlan[]>([]);
  const [hiddenPlanIds, setHiddenPlanIds] = useState<Set<string>>(new Set());

  const constraints = useMemo(
    () => constraintsText.split('\n').map((s) => s.trim()).filter(Boolean),
    [constraintsText],
  );

  const dirty = useMemo(
    () => (draft && pristine ? JSON.stringify(draft) !== JSON.stringify(pristine) : false),
    [draft, pristine],
  );

  const loadHistory = async () => {
    const rows = await listPlans(projectId);
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    setHistory(rows);
  };

  useEffect(() => {
    setAccepted(getAcceptedPlan(projectId));
    setHiddenPlanIds(getHiddenPlanIds(projectId));
    setDraft(null);
    setDraftSource(null);
    setPristine(null);
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const removeFromHistory = (id: string) => {
    hidePlanId(projectId, id);
    setHiddenPlanIds(new Set(getHiddenPlanIds(projectId)));
    onToast('Plan removed from the list.');
  };

  const visibleHistory = history.filter((r) => !hiddenPlanIds.has(r.id));

  useEffect(() => {
    if (!generating) return;
    setStepIdx(0);
    const t = setInterval(() => setStepIdx((i) => (i + 1) % LOADER_STEPS.length), 2500);
    return () => clearInterval(t);
  }, [generating]);

  // ---- AI generate -----------------------------------------------------
  const buildInput = (): GeneratePlanInput => ({
    description: description.trim(),
    projectName: projectName?.trim() || undefined,
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
    try {
      const gen: GeneratedPlan = await generatePlan(input, abortRef.current.signal);
      const p = clone(gen.plan);
      setDraft(p);
      setPristine(clone(p));
      setDraftSource('ai');
      setDraftMeta({ planId: gen.id, generatedBy: gen.generatedBy, model: gen.model });
      setLastInput(input);
      onToast(
        gen.generatedBy === 'google'
          ? `Plan generated — ${gen.plan.sprints?.length ?? 0} sprints. Review, edit, then accept.`
          : 'Fallback plan generated. Review, edit, then accept.',
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

  // ---- manual -------------------------------------------------------
  const startBlank = () => {
    const p = emptyPlan();
    setDraft(p);
    setPristine(null);
    setDraftSource('manual');
    setDraftMeta({});
  };

  const startFromLastAi = () => {
    if (!visibleHistory.length) return;
    const p = clone(visibleHistory[0].plan);
    setDraft(p);
    setPristine(null);
    setDraftSource('manual');
    setDraftMeta({});
    onToast('Loaded the latest AI plan for manual editing.');
  };

  // ---- accept / discard -------------------------------------------------
  const acceptDraft = () => {
    if (!draft || !draftSource) return;
    if (!draft.planName.trim()) {
      onToast('Give the plan a name before accepting.');
      return;
    }
    const record: AcceptedPlanRecord = {
      source: draftSource,
      acceptedAt: new Date().toISOString(),
      planId: draftMeta.planId,
      generatedBy: draftMeta.generatedBy,
      model: draftMeta.model,
      plan: clone(draft),
    };
    saveAcceptedPlan(projectId, record);
    setAccepted(record);
    onToast('Plan accepted for this project.');
  };

  const discardAccepted = () => {
    clearAcceptedPlan(projectId);
    setAccepted(null);
    onToast('Accepted plan discarded.');
  };

  const viewAccepted = () => {
    if (!accepted) return;
    setDraft(clone(accepted.plan));
    setPristine(null);
    setDraftSource(accepted.source);
    setDraftMeta({
      planId: accepted.planId,
      generatedBy: accepted.generatedBy,
      model: accepted.model,
    });
    setMode(accepted.source);
  };

  const resetEdits = () => {
    if (pristine) {
      setDraft(clone(pristine));
      onToast('Reverted to the generated plan.');
    }
  };

  const openSaved = async (row: SavedPlan) => {
    const doc = row.plan ? row : await getPlan(row.id);
    if (!doc) {
      onToast('Could not load that plan.');
      return;
    }
    const p = clone(doc.plan);
    setDraft(p);
    setPristine(clone(p));
    setDraftSource('ai');
    setDraftMeta({ planId: doc.id, generatedBy: doc.provider, model: doc.model });
    setMode('ai');
  };

  const acceptedIsCurrent =
    accepted && draft ? JSON.stringify(accepted.plan) === JSON.stringify(draft) : false;

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center justify-between text-indigo-700 text-xs font-black uppercase tracking-widest">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4" />
          <span>AI Sprint Planner</span>
        </div>
        <div className="flex border border-slate-300">
          {(['ai', 'manual'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                mode === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m === 'ai' ? 'AI generate' : 'Manual entry'}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------- accepted banner */}
      {accepted && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-600 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-emerald-800">
            <CircleCheck className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">
              Accepted plan
            </span>
            <span className="text-[11px] font-mono text-emerald-700">
              {accepted.plan.planName || 'Untitled'} · {accepted.source === 'ai' ? 'AI + edits' : 'manual'} ·{' '}
              {accepted.acceptedAt.slice(0, 10)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={viewAccepted}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider border border-emerald-600"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>View / edit</span>
            </button>
            <button
              onClick={discardAccepted}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ================================================= LEFT column === */}
        <div className="p-5 bg-white border border-slate-300 space-y-3">
          {mode === 'ai' ? (
            <>
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
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
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
            </>
          ) : (
            <>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
                Manual entry
              </h3>
              <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
                Build the sprint plan by hand, or start from the latest AI draft and edit
                it. Nothing is sent to the AI. Accepted plans are stored for this project.
              </p>
              {draftSource === 'manual' && draft ? (
                <p className="text-[11px] font-mono text-indigo-700 uppercase tracking-wider">
                  Editing a manual plan — see the right panel.
                </p>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={startBlank}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>Start blank plan</span>
                  </button>
                  <button
                    onClick={startFromLastAi}
                    disabled={!visibleHistory.length}
                    className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-widest border border-slate-300 disabled:opacity-40"
                  >
                    <RefreshCw className="w-4 h-4 text-indigo-600" />
                    <span>Start from last AI plan</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* ----------------------------------------- prior plans -------- */}
          {visibleHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                <History className="w-3 h-3" />
                <span>Previous plans</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {visibleHistory.map((row) => (
                  <div
                    key={row.id}
                    className="w-full flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-slate-100 border border-slate-200"
                  >
                    <button
                      onClick={() => openSaved(row)}
                      className="flex-1 min-w-0 flex items-center justify-between text-left"
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
                    <button
                      onClick={() => removeFromHistory(row.id)}
                      title="Remove from list (local only — the backend has no plan delete)"
                      className="shrink-0 p-0.5 text-slate-300 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================ RIGHT column === */}
        <div className="p-5 bg-white border border-slate-300 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
              {draftSource === 'manual' ? 'Plan draft' : 'Generated plan'}
            </h3>
            {draftMeta.generatedBy && draftSource === 'ai' && (
              <div className="flex items-center gap-1.5">
                <ProviderBadge provider={draftMeta.generatedBy} />
                {draftMeta.model && (
                  <span className="text-[9px] font-mono text-slate-400 uppercase">
                    {draftMeta.model}
                  </span>
                )}
              </div>
            )}
          </div>

          {!draft && !generating && (
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-10 text-center">
              {mode === 'ai'
                ? 'Fill the brief, then generate a plan'
                : 'Start a blank plan or load the last AI draft'}
            </p>
          )}

          {generating && (
            <div className="flex items-center justify-center py-10 text-slate-500 text-xs font-mono uppercase tracking-widest">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {LOADER_STEPS[stepIdx]}…
            </div>
          )}

          {draft && !generating && (
            <>
              {/* ---- action bar ---- */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200">
                <button
                  onClick={acceptDraft}
                  disabled={acceptedIsCurrent}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider border border-emerald-700 disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{acceptedIsCurrent ? 'Accepted' : 'Accept plan'}</span>
                </button>

                {draftSource === 'ai' && (
                  <>
                    <button
                      onClick={() => lastInput && run(lastInput)}
                      disabled={generating || !lastInput}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Regenerate</span>
                    </button>
                    <button
                      onClick={resetEdits}
                      disabled={!dirty}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset edits</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setDraft(null);
                    setDraftSource(null);
                    setPristine(null);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>

                <button
                  disabled
                  title="Pending backend: POST /v1/plans/:id/apply"
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white text-slate-400 text-[11px] font-bold uppercase tracking-wider border border-slate-200 cursor-not-allowed"
                >
                  <span>Apply to project</span>
                </button>
              </div>

              {dirty && draftSource === 'ai' && (
                <p className="text-[10px] font-mono text-amber-700 uppercase tracking-wider">
                  Edited — differs from the generated plan.
                </p>
              )}

              <PlanEditor value={draft} onChange={setDraft} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// Editable plan
// ===========================================================================

const PlanEditor: React.FC<{ value: SprintPlan; onChange: (p: SprintPlan) => void }> = ({
  value,
  onChange,
}) => {
  const set = (partial: Partial<SprintPlan>) => onChange({ ...value, ...partial });

  const setSprint = (i: number, s: PlanSprint) =>
    set({ sprints: value.sprints.map((x, idx) => (idx === i ? s : x)) });
  const addSprint = () =>
    set({ sprints: [...value.sprints, emptySprint(value.sprints.length + 1)] });
  const removeSprint = (i: number) =>
    set({
      sprints: value.sprints
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, index: idx + 1 })),
    });

  return (
    <div className="space-y-4">
      <L label="Plan name *">
        <input
          value={value.planName}
          onChange={(e) => set({ planName: e.target.value })}
          placeholder="Sprint Plan — …"
          className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
        />
      </L>
      <L label="Summary">
        <textarea
          value={value.summary}
          onChange={(e) => set({ summary: e.target.value })}
          rows={2}
          className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none resize-none"
        />
      </L>

      {/* sprints */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Sprints ({value.sprints.length})
          </span>
          <button
            onClick={addSprint}
            className="flex items-center space-x-1 text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            <span>Add sprint</span>
          </button>
        </div>
        {value.sprints.map((s, i) => (
          <SprintEditor
            key={i}
            sprint={s}
            onChange={(next) => setSprint(i, next)}
            onRemove={() => removeSprint(i)}
            canRemove={value.sprints.length > 1}
          />
        ))}
      </div>

      <ListEditor<PlanMilestone>
        icon={Flag}
        title="Milestones"
        rows={value.milestones ?? []}
        onChange={(milestones) => set({ milestones })}
        blank={{ name: '', date: '', description: '' }}
        fields={[
          { key: 'name', placeholder: 'Milestone', kind: 'text', grow: true },
          { key: 'date', placeholder: '', kind: 'date' },
        ]}
      />

      <ListEditor<PlanDeadline>
        icon={CalendarClock}
        title="Deadlines"
        rows={value.deadlines ?? []}
        onChange={(deadlines) => set({ deadlines })}
        blank={{ label: '', date: '' }}
        fields={[
          { key: 'label', placeholder: 'Deadline', kind: 'text', grow: true },
          { key: 'date', placeholder: '', kind: 'date' },
        ]}
      />

      <ListEditor<PlanRisk>
        icon={AlertTriangle}
        title="Risks"
        rows={value.risks ?? []}
        onChange={(risks) => set({ risks })}
        blank={{ description: '', severity: 'medium', mitigation: '' }}
        fields={[
          { key: 'description', placeholder: 'Risk', kind: 'text', grow: true },
          { key: 'severity', placeholder: '', kind: 'select', options: SEVERITIES },
          { key: 'mitigation', placeholder: 'Mitigation', kind: 'text', grow: true },
        ]}
      />

      <L label="Assumptions (one per line)">
        <textarea
          value={(value.assumptions ?? []).join('\n')}
          onChange={(e) =>
            set({ assumptions: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
          }
          rows={3}
          className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none resize-none"
        />
      </L>
    </div>
  );
};

const SprintEditor: React.FC<{
  sprint: PlanSprint;
  onChange: (s: PlanSprint) => void;
  onRemove: () => void;
  canRemove: boolean;
}> = ({ sprint, onChange, onRemove, canRemove }) => {
  const set = (partial: Partial<PlanSprint>) => onChange({ ...sprint, ...partial });
  const setTask = (i: number, t: PlanTask) =>
    set({ tasks: sprint.tasks.map((x, idx) => (idx === i ? t : x)) });

  return (
    <div className="border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={sprint.name}
          onChange={(e) => set({ name: e.target.value })}
          className="flex-1 bg-white border border-slate-300 px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
        />
        <input
          type="number"
          min={0}
          value={sprint.plannedPoints ?? ''}
          onChange={(e) =>
            set({ plannedPoints: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          placeholder="pts"
          className="w-16 bg-white border border-slate-300 px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none"
        />
        <button
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? 'Remove sprint' : 'A plan must keep at least one sprint'}
          className="disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
        </button>
      </div>

      <input
        value={sprint.goal ?? ''}
        onChange={(e) => set({ goal: e.target.value })}
        placeholder="Sprint goal"
        className="w-full bg-white border border-slate-300 px-2 py-1 text-[11px] font-mono text-slate-700 focus:outline-none"
      />

      <div className="grid grid-cols-3 gap-2">
        <DateField label="Start" value={sprint.startDate} onChange={(startDate) => set({ startDate })} />
        <DateField label="End" value={sprint.endDate} onChange={(endDate) => set({ endDate })} />
        <DateField
          label="Deadline"
          value={sprint.deadline}
          onChange={(deadline) => set({ deadline })}
        />
      </div>

      {/* tasks */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            Tasks ({sprint.tasks.length})
          </span>
          <button
            onClick={() => set({ tasks: [...sprint.tasks, emptyTask()] })}
            className="flex items-center space-x-1 text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            <span>Add task</span>
          </button>
        </div>
        {sprint.tasks.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 p-1.5">
            <input
              value={t.title}
              onChange={(e) => setTask(i, { ...t, title: e.target.value })}
              placeholder="Task title"
              className="flex-1 min-w-[120px] border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 focus:outline-none"
            />
            <select
              value={t.assigneeRole ?? ''}
              onChange={(e) => setTask(i, { ...t, assigneeRole: e.target.value })}
              className="border border-slate-200 px-1 py-0.5 text-[10px] font-mono text-slate-600 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r || 'role'}
                </option>
              ))}
            </select>
            <select
              value={t.priority ?? 'medium'}
              onChange={(e) => setTask(i, { ...t, priority: e.target.value })}
              className="border border-slate-200 px-1 py-0.5 text-[10px] font-mono text-slate-600 focus:outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={t.storyPoints ?? ''}
              onChange={(e) =>
                setTask(i, {
                  ...t,
                  storyPoints: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="pts"
              className="w-12 border border-slate-200 px-1 py-0.5 text-[10px] font-mono text-slate-600 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              value={t.estimateHours ?? ''}
              onChange={(e) =>
                setTask(i, {
                  ...t,
                  estimateHours: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              placeholder="hrs"
              className="w-12 border border-slate-200 px-1 py-0.5 text-[10px] font-mono text-slate-600 focus:outline-none"
            />
            <button
              onClick={() => set({ tasks: sprint.tasks.filter((_, idx) => idx !== i) })}
              title="Remove task"
            >
              <X className="w-3 h-3 text-rose-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Generic repeatable-row editor for milestones / deadlines / risks
// ---------------------------------------------------------------------------

type FieldSpec = {
  key: string;
  placeholder: string;
  kind: 'text' | 'date' | 'select';
  options?: string[];
  grow?: boolean;
};

function ListEditor<T extends Record<string, any>>({
  icon: Icon,
  title,
  rows,
  onChange,
  blank,
  fields,
}: {
  icon: React.ElementType;
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: T;
  fields: FieldSpec[];
}) {
  const setRow = (i: number, patch: Partial<T>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <Icon className="w-3 h-3" />
          <span>
            {title} ({rows.length})
          </span>
        </div>
        <button
          onClick={() => onChange([...rows, { ...blank }])}
          className="flex items-center space-x-1 text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
        >
          <Plus className="w-3 h-3" />
          <span>Add</span>
        </button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 p-1.5">
          {fields.map((f) => {
            const common =
              'border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 focus:outline-none bg-white';
            if (f.kind === 'select') {
              return (
                <select
                  key={f.key}
                  value={r[f.key] ?? ''}
                  onChange={(e) => setRow(i, { [f.key]: e.target.value } as Partial<T>)}
                  className={common}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              );
            }
            return (
              <input
                key={f.key}
                type={f.kind === 'date' ? 'date' : 'text'}
                value={r[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setRow(i, { [f.key]: e.target.value } as Partial<T>)}
                className={`${common} ${f.grow ? 'flex-1 min-w-[120px]' : ''}`}
              />
            );
          })}
          <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))} title="Remove">
            <X className="w-3 h-3 text-rose-500" />
          </button>
        </div>
      ))}
    </div>
  );
}

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

const DateField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <label className="block">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
      {label}
    </span>
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-slate-300 px-1.5 py-1 text-[10px] font-mono text-slate-800 focus:outline-none"
    />
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
