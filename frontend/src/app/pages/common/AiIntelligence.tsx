'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Sparkles,
  Sliders,
  Send,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { AIPrediction, AIProviderName } from '@shared/models';
import { CalculatedAnalytics } from '@core/services/analytics-calculator';
import {
  askAiAssistant,
  getDelayPrediction,
  simulateDelay,
  DelayDriverKey,
  DelayPrediction,
  DelaySimulation,
} from '@core/services';
import { Collapsible } from '@shared/components/Collapsible';
import { AiAnswer } from '@shared/components/AiAnswer';
import { ProjectContextPanel } from '@pages/common/ProjectContextPanel';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  error?: boolean;
}

const SUGGESTED_PROMPTS = [
  'How can we reduce PR review delay without overloading the Tech Lead?',
  'Which developers are the biggest bottlenecks right now?',
  'Where is code churn highest, and is it a risk?',
  'What timeline adjustment would bring the sprint back on track?',
];

/**
 * The four drivers the backend scores. `sensitivity[key].reference` is the worst
 * value each is measured against; `neutral` is where the slider starts when the
 * project does not track the signal (0 bugs / 100% QA contribute no points, so
 * they are honest what-ifs rather than invented risks).
 */
interface DriverConfig {
  key: DelayDriverKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  neutral: number;
  /** true => a higher value is safer (QA capacity). */
  betterWhenHigh?: boolean;
  accent: string;
  text: string;
}

const DRIVER_CONFIG: DriverConfig[] = [
  { key: 'prReviewLatencyHours', label: 'PR Review Latency', unit: 'hrs', min: 2, max: 48, step: 1, neutral: 2, accent: 'accent-indigo-600', text: 'text-indigo-700' },
  { key: 'sprintVelocityDeficitPercent', label: 'Sprint Velocity Deficit', unit: '%', min: 0, max: 100, step: 1, neutral: 0, accent: 'accent-amber-600', text: 'text-amber-700' },
  { key: 'criticalBugs', label: 'Critical Bugs Count', unit: 'bugs', min: 0, max: 10, step: 1, neutral: 0, accent: 'accent-rose-600', text: 'text-rose-700' },
  { key: 'qaCapacityPercent', label: 'QA Test Capacity', unit: '%', min: 10, max: 100, step: 1, neutral: 100, betterWhenHigh: true, accent: 'accent-emerald-600', text: 'text-emerald-700' },
];

type DriverValues = Record<DelayDriverKey, number>;

/** Why a driver has no baseline → the caption shown under its slider. */
const DRIVER_REASON_TEXT: Record<string, string> = {
  NO_BUG_SEVERITY_TRACKED: 'Bug severity is not tracked in Taiga',
  NO_QA_ROLE_ON_PROJECT: 'No QA role assigned on this project',
  NO_MERGED_PULL_REQUESTS: 'Not enough data',
  NO_VELOCITY_DATA: 'Not enough data',
};

/** How `confidence` was derived — a fallback must never read as a modelled probability. */
const CONFIDENCE_BASIS_TEXT: Record<string, string> = {
  FORECAST_DATA_QUALITY: "Derived from the forecast's data quality",
  RISK_LEVEL_FALLBACK: 'Estimated from the stored risk level — not enough delivery history',
};

/** `MODERATE_RISK` → "Moderate Risk". */
const verdictLabel = (verdict?: string) =>
  (verdict || '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ') || '—';

/** `pr_review_latency_hours` → `prReviewLatencyHours` (matches `DelayDriverKey`). */
const camelDriverKey = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** `YYYY-MM-DD` or null — never hand an empty string to `new Date()`. */
const fmtIsoDate = (value: string | null | undefined, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
};

let messageSeq = 0;
const newId = () => `msg-${Date.now()}-${messageSeq++}`;

interface AiIntelligenceProps {
  projectId: string;
  prediction: AIPrediction | null;
  analytics: CalculatedAnalytics;
  onRunPrediction: (customPrompt?: string, provider?: AIProviderName) => Promise<void>;
  isPredicting: boolean;
  activeProvider: AIProviderName;
  activeModel: string;
}

export const AiIntelligence: React.FC<AiIntelligenceProps> = ({
  projectId,
  prediction,
  analytics,
  onRunPrediction,
  isPredicting,
  activeProvider,
  activeModel,
}) => {
  /**
   * The ring number, finish date, confidence and every slider baseline come from
   * the deterministic delay endpoint. `analytics.delayProbability` was always 0 and
   * `prediction.predictedFinishDate` was always empty, which is what rendered
   * "Invalid Date" and "0%"; this endpoint returns the documented 65% / 2027-08-24.
   */
  const [baseline, setBaseline] = useState<DelayPrediction | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState(true);
  const [simulation, setSimulation] = useState<DelaySimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const [drivers, setDrivers] = useState<DriverValues>(
    () => Object.fromEntries(DRIVER_CONFIG.map((d) => [d.key, d.neutral])) as DriverValues,
  );

  /** Completion-derived deficit — only used when the backend has no velocity driver. */
  const analyticsDeficit = Math.max(
    0,
    Math.round(100 - (analytics?.sprintMetrics.completionPercentage ?? 0)),
  );

  const loadBaseline = async () => {
    setLoadingBaseline(true);
    try {
      const next = await getDelayPrediction(projectId);
      setBaseline(next);
      setBaselineError(next ? null : 'The delay model returned no data for this project.');
      if (next) {
        // Seed each slider from its stored baseline, or from the neutral value when
        // the project does not track that signal (`baseline: null`).
        setDrivers(
          Object.fromEntries(
            DRIVER_CONFIG.map((d) => [
              d.key,
              next.drivers?.[d.key]?.baseline ??
                (d.key === 'sprintVelocityDeficitPercent' ? analyticsDeficit : d.neutral),
            ]),
          ) as DriverValues,
        );
      }
    } catch (err: any) {
      setBaseline(null);
      setBaselineError(err?.msg || err?.message || 'Delay prediction is unavailable.');
    } finally {
      setLoadingBaseline(false);
    }
  };

  // Refetch on mount, on project switch, and after "Recalculate AI Model".
  useEffect(() => {
    setSimulation(null);
    void loadBaseline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, prediction?.generatedAt]);
  
  // Chat history exists only while this section is mounted. Navigating to a
  // different section, refreshing, or changing project starts a clean thread.
  const [customPrompt, setCustomPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A project change within the mounted section also starts a clean thread.
  useEffect(() => {
    setMessages([]);
    setCustomPrompt('');
  }, [projectId]);

  // The ring shows the scenario once one has been run, and the baseline otherwise.
  const active = simulation?.scenario;
  const delayProb = Math.round(active?.delayProbability ?? baseline?.delayProbability ?? 0);
  const finishDate = active?.predictedFinishDate ?? baseline?.predictedFinishDate ?? null;
  const confidence = baseline?.confidence ?? 0;
  const confidenceBasisText = CONFIDENCE_BASIS_TEXT[baseline?.confidenceBasis ?? ''] ?? '';
  const delta = simulation?.scenario.deltaPoints ?? 0;
  const scenarioModified = Math.abs(delta) >= 0.1;
  const shiftedWorkingDays = simulation?.scenario.shiftedWorkingDays ?? null;
  // Why the date can stand still while the ring moves: shiftFinishDate rounds
  // `remainingWorkingDays × Δ/100` to whole working days, so a large risk change
  // with almost no time left still rounds to 0. Surface that number in the UI.
  const approxShiftDays =
    baseline?.remainingWorkingDays != null && delta !== 0
      ? (baseline.remainingWorkingDays * delta) / 100
      : null;

  // Keep the newest message in view.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isAsking]);

  // Hidden collapsible content has no measurable height. Resize again when
  // opened or when its width changes, and always leave room for one full line.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const resize = () => {
      if (!el.getClientRects().length) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(40, Math.min(el.scrollHeight, 128))}px`;
      el.style.overflowY = el.scrollHeight > 128 ? 'auto' : 'hidden';
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [customPrompt]);

  /**
   * Re-scores the scenario against the stored baseline. Any subset of the four
   * drivers is accepted; a driver left at its baseline contributes 0 points, so
   * Reset (below) returns the ring to the baseline number.
   */
  const handleSimulate = async () => {
    setSimError(null);
    setSimulating(true);
    try {
      setSimulation(await simulateDelay(projectId, drivers));
    } catch (err: any) {
      setSimulation(null);
      setSimError(err?.msg || err?.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  /** Put every slider back on the stored baseline (or its neutral value). */
  const handleResetDrivers = () =>
    setDrivers(
      Object.fromEntries(
        DRIVER_CONFIG.map((d) => [
          d.key,
          baseline?.drivers?.[d.key]?.baseline ??
            (d.key === 'sprintVelocityDeficitPercent' ? analyticsDeficit : d.neutral),
        ]),
      ) as DriverValues,
    );

  /**
   * XAI rows. The spec says to prefer the scenario's `contributions` once a
   * simulation has run — those are the real per-driver points for the number in
   * the ring — and to fall back to the stored `featureImportances` otherwise.
   */
  const xaiRows: {
    feature: string;
    weight: number;
    description: string;
    source?: string;
    points?: number;
  }[] =
    simulation && simulation.contributions.length
      ? simulation.contributions.map((contribution) => ({
          // `contributions[].key` is snake_case; prefer the backend's own label.
          feature:
            contribution.label ??
            DRIVER_CONFIG.find((d) => d.key === camelDriverKey(contribution.key))?.label ??
            contribution.key,
          weight: Math.abs(contribution.points),
          description:
            contribution.basis || `${contribution.direction === 'decreases' ? 'Reduces' : 'Increases'} risk`,
          points: contribution.points,
        }))
      : (baseline?.featureImportances ?? []).map((importance) => ({
          feature: importance.feature,
          weight: importance.weight,
          description: importance.description,
          source: importance.source,
        }));

  const recommendations = baseline?.recommendations ?? [];

  const sendMessage = async (text: string) => {
    const query = text.trim();
    if (!query || isAsking || !activeModel) return;

    const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: query, time: time() }]);
    setCustomPrompt('');
    setIsAsking(true);

    try {
      const history = messages
        .filter((message) => !message.error)
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.text }));
      const data = await askAiAssistant(query, projectId, null, activeProvider, activeModel, history);
      const answer = data.answer || data.response || 'No answer returned by the AI service.';
      // Keep the exchange in component state only.
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: answer,
          time: time(),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: `Request failed: ${err?.msg || err?.message || 'AI service unavailable'}`,
          time: time(),
          error: true,
        },
      ]);
    } finally {
      setIsAsking(false);
      inputRef.current?.focus();
    }
  };

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(customPrompt);
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — ignore.
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
              <Brain className="w-4 h-4" />
              <span>AI Delivery Risk &amp; Recommendation Engine</span>
            </div>
            <h2 className="text-xl font-black italic tracking-tighter text-slate-900">Predictive Intelligence Center</h2>
            <p className="text-xs text-slate-600 mt-1 font-sans">
              Powered by <span className="text-indigo-700 font-bold">{prediction?.aiProviderUsed || activeProvider}</span> •
              Continuous machine learning analysis of GitHub commits, PRs, and Taiga metrics.
            </p>
          </div>

          <button
            onClick={() => onRunPrediction()}
            disabled={isPredicting}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest transition border border-black disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPredicting ? 'animate-spin' : ''}`} />
            <span>{isPredicting ? 'Running AI Model...' : 'Recalculate AI Model'}</span>
          </button>
        </div>
      </div>

      {/* Chat-style AI Ops Assistant */}
      <Collapsible title="Ask AI Ops Assistant" icon={Bot} defaultOpen bodyClassName="">
        <div className="bg-white border border-slate-300 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shadow-md ring-2 ring-white/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                    activeModel ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">AI Ops Assistant</div>
                <div className="text-[10px] text-indigo-200 font-mono truncate">
                  {isAsking
                    ? 'typing…'
                    : activeModel
                    ? `Online • ${activeProvider} · ${activeModel}`
                    : 'Offline • select a model to start chatting'}
                </div>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                }}
                disabled={isAsking}
                title="Clear conversation"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-100 hover:text-white hover:bg-white/10 rounded-md transition disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>

          {/* Message thread */}
          <div
            ref={threadRef}
            className="h-[26rem] overflow-y-auto px-4 py-5 space-y-4 bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] [background-size:18px_18px]"
          >
            {messages.length === 0 ? (
              <div className="min-h-full flex flex-col items-center justify-center text-center px-1 sm:px-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mb-3">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h4 className="text-sm font-black text-slate-900">How can I help your delivery today?</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Ask about code churn, developer bottlenecks, sprint risk or timeline adjustments.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-2xl">
                  {SUGGESTED_PROMPTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      disabled={isAsking || !activeModel}
                      className="px-3 py-2 text-left text-xs text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-400 hover:text-indigo-700 hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end gap-2">
                    <div className="max-w-[80%] flex flex-col items-end">
                      <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words">
                        {m.text}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-1 mr-1">{m.time}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 self-end mb-5">
                      <User className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 self-end mb-5 ${
                        m.error ? 'bg-rose-100 text-rose-600' : 'bg-gradient-to-br from-indigo-400 to-violet-600 text-white'
                      }`}
                    >
                      {m.error ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className="max-w-[88%] md:max-w-[82%] flex flex-col items-start">
                      <div
                        className={`ai-bubble rounded-2xl rounded-bl-sm text-sm leading-relaxed shadow-sm break-words border ${
                          m.error
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-green-50 border-green-200 text-slate-800'
                        }`}
                      >
                        {m.error ? m.text : <AiAnswer text={m.text} />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-1">
                        <span className="text-[10px] text-slate-400 font-mono">{m.time}</span>
                        {!m.error && (
                          <button
                            type="button"
                            onClick={() => copyMessage(m.id, m.text)}
                            title="Copy answer"
                            className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )
            )}

            {isAsking && (
              <div className="flex justify-start gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-slate-200 shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={handleAskAI} className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 pl-4 pr-1.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition">
              <textarea
                ref={inputRef}
                aria-label="Message AI Ops Assistant"
                rows={1}
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendMessage(customPrompt);
                  }
                }}
                placeholder={
                  activeModel
                    ? 'Ask about your project…'
                    : 'Select an AI provider and model to start chatting'
                }
                className="block min-w-0 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-10 max-h-32"
              />
              <button
                type="submit"
                disabled={isAsking || !customPrompt.trim() || !activeModel}
                title="Send"
                className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white flex items-center justify-center shadow transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1.5 px-2">
              Enter to send · Shift + Enter for a new line · Answers are grounded in this project&apos;s context
            </p>
          </form>
        </div>
      </Collapsible>

      {/* Grid: Delay Prediction Meter & Risk Simulator */}
      <Collapsible title="Delay prediction & risk simulator" defaultOpen bodyClassName="">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Ring & Gauge (1 Column) */}
        <div className="p-6 bg-white border border-slate-300 flex flex-col justify-between items-center text-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
            Predicted Delivery Delay Probability
          </span>

          <div className="relative my-4 flex items-center justify-center">
            <div
              className={`w-40 h-40 border-4 flex flex-col items-center justify-center bg-slate-50 ${
                delayProb > 70
                  ? 'border-rose-600 text-rose-800'
                  : delayProb > 40
                  ? 'border-amber-500 text-amber-800'
                  : 'border-emerald-600 text-emerald-800'
              }`}
            >
              {loadingBaseline && !baseline ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <span className="text-4xl font-black text-slate-900">{delayProb}%</span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider mt-1">
                    {verdictLabel(active?.verdict ?? baseline?.verdict)}
                  </span>
                </>
              )}
            </div>
          </div>

          {simulation && (
            <span
              className={`mb-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                scenarioModified
                  ? delta > 0
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              {scenarioModified ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts vs baseline` : 'At baseline'}
            </span>
          )}

          {simulation && baseline && (
            <span className="mb-1 text-[10px] font-mono text-slate-500">
              Baseline {Math.round(baseline.delayProbability)}%
            </span>
          )}

          <div className="w-full space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
              <span>Predicted Finish Date:</span>
              <span className="font-bold text-rose-700">{fmtIsoDate(finishDate, 'No date')}</span>
            </div>
            {shiftedWorkingDays != null && (
              <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
                <span>Scenario shift:</span>
                {shiftedWorkingDays === 0 ? (
                  <span className="font-semibold text-slate-500">No schedule change</span>
                ) : (
                  <span className="font-bold text-slate-800">
                    {Math.abs(shiftedWorkingDays)} working day{Math.abs(shiftedWorkingDays) === 1 ? '' : 's'}{' '}
                    {shiftedWorkingDays > 0 ? 'later' : 'earlier'}
                  </span>
                )}
              </div>
            )}
            <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
              <span>AI Confidence Score:</span>
              <span
                className="font-bold text-indigo-700 cursor-help"
                title={confidenceBasisText || undefined}
              >
                {baseline ? `${confidence}%` : '—'}
              </span>
            </div>
            {baseline?.targetDate && (
              <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
                <span>Target date:</span>
                <span className="font-bold text-slate-800">{fmtIsoDate(baseline.targetDate)}</span>
              </div>
            )}
          </div>

          {scenarioModified && shiftedWorkingDays === 0 && approxShiftDays != null && (
            <p className="mt-2 text-left text-[10px] font-mono text-slate-500">
              No date shift:{' '}
              {baseline?.remainingWorkingDays != null
                ? `${baseline.remainingWorkingDays} working day${baseline.remainingWorkingDays === 1 ? '' : 's'} remaining \u00d7 ${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts = ${approxShiftDays >= 0 ? '+' : ''}${approxShiftDays.toFixed(1)} working day${Math.abs(approxShiftDays) === 1 ? '' : 's'} \u2248 0`
                : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts rounds to under one working day`}
              , so the finish date is unchanged.
            </p>
          )}

          {confidenceBasisText && (
            <p className="mt-2 text-[10px] font-mono text-slate-500">{confidenceBasisText}</p>
          )}
          {baselineError && <p className="mt-2 text-[10px] font-mono text-rose-700">{baselineError}</p>}
        </div>

        {/* Interactive Risk Simulator Sliders (2 Columns) */}
        <div className="lg:col-span-2 p-6 bg-white border border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
              <Sliders className="w-4 h-4 text-indigo-600 mr-2" />
              What-If Scenario Risk Simulator
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Adjust parameters &amp; test sensitivity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
            {DRIVER_CONFIG.map((driver) => {
              const value = drivers[driver.key];
              const meta = baseline?.drivers?.[driver.key];
              const sensitivity = baseline?.sensitivity?.[driver.key];
              const reason = meta?.reason ? DRIVER_REASON_TEXT[meta.reason] ?? meta.reason : '';
              const shown = `${value}${driver.unit === '%' ? '%' : ` ${driver.unit}`}`;
              return (
                <div key={driver.key}>
                  <div className="flex justify-between text-xs font-mono font-bold text-slate-800 mb-1">
                    <span>{driver.label}</span>
                    <span className={`${driver.text} font-black`}>{shown}</span>
                  </div>
                  <input
                    type="range"
                    min={driver.min}
                    max={driver.max}
                    step={driver.step}
                    value={value}
                    onChange={(e) =>
                      setDrivers((prev) => ({ ...prev, [driver.key]: Number(e.target.value) }))
                    }
                    className={`w-full h-2 bg-slate-200 cursor-pointer ${driver.accent}`}
                  />
                  <div className="flex justify-between gap-2 mt-1 text-[10px] font-mono text-slate-500">
                    <span>
                      {reason
                        ? `no data — what-if only (${reason})`
                        : meta?.source
                        ? `baseline ${meta.baseline} · ${meta.source}`
                        : 'baseline'}
                    </span>
                    {sensitivity && <span className="shrink-0">max +{sensitivity.maxPoints} pts</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-[10px] font-mono text-slate-500">
              {simError ? (
                <span className="text-rose-700">{simError}</span>
              ) : baseline ? (
                <>
                  Baseline <span className="font-bold">{Math.round(baseline.delayProbability)}%</span> ·{' '}
                  {baseline.modelVersion}
                </>
              ) : (
                'Baseline unavailable'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDrivers}
                disabled={simulating || loadingBaseline}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-widest border border-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                Reset to baseline
              </button>
              <button
                type="button"
                onClick={handleSimulate}
                disabled={simulating || loadingBaseline}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
              >
                {simulating && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Simulate Scenario Prediction
              </button>
            </div>
          </div>
        </div>
      </div>
      </Collapsible>

      {/* Feature Importance & Actionable Recommendations */}
      <Collapsible title="Explainable AI & recommendations" bodyClassName="">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Importance Breakdown */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <Zap className="w-4 h-4 text-indigo-600 mr-2" />
            Explainable AI (XAI) Feature Importances
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">
            Weighted drivers increasing or decreasing delivery risk
          </p>

          <div className="space-y-4">
            {xaiRows.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-400">
                No stored drivers yet — run Recalculate AI Model.
              </p>
            ) : (
              xaiRows.map((row, idx) => (
                <div key={`${row.feature}-${idx}`} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-slate-900">
                    <span className="truncate pr-2">{row.feature}</span>
                    <span className="shrink-0 text-indigo-700">
                      {row.points != null
                        ? `${row.points > 0 ? '+' : ''}${row.points} pts`
                        : `${row.weight}% weight`}
                      {row.source && (
                        <span className="ml-1 text-[9px] uppercase text-slate-500">{row.source}</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 overflow-hidden">
                    <div
                      className={`h-full ${row.points != null && row.points < 0 ? 'bg-emerald-600' : 'bg-indigo-600'}`}
                      style={{
                        width: `${Math.min(100, Math.max(10, Math.abs(row.points ?? row.weight) * 2.5))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 font-sans">{row.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Action Recommendations */}
        <div className="p-6 bg-white border border-slate-300 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2" />
              AI Action Plan &amp; Recommendations
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mb-4">
              Stored mitigations from the risk analysis, ordered by severity
            </p>

            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-400">
                  No mitigation steps stored — run Recalculate AI Model.
                </p>
              ) : (
                recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 border border-slate-200 flex items-start space-x-3"
                  >
                    <div className="w-5 h-5 bg-indigo-600 text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-slate-800 font-sans leading-relaxed">{rec}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-300 flex items-center justify-between text-xs font-mono text-slate-600">
            <span>Model Provider:</span>
            <span className="font-bold text-indigo-700">{prediction?.aiProviderUsed}</span>
          </div>
        </div>
      </div>
      </Collapsible>

      {/* Stored context the chat is grounded in */}
      <Collapsible title="Project context" icon={Brain}>
        <ProjectContextPanel projectId={projectId} />
      </Collapsible>


    </div>
  );
};
