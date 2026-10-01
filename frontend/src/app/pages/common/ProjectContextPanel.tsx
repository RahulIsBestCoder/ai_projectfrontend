'use client';

import React, { useEffect, useState } from 'react';
import { Brain, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { ProjectContextSnapshot } from '@shared/models';
import { getProjectContext, rebuildProjectContext } from '@core/services';

const CHAR_BUDGET = 2500;

function relTime(iso?: string): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * The AI chat reads a stored project-context snapshot when `project_id` is
 * passed. This panel shows how fresh that grounding is and lets the user force
 * a rebuild (one Gemini call — the button shows an indeterminate state).
 */
export const ProjectContextPanel: React.FC<{
  projectId: string;
  onToast?: (m: string) => void;
}> = ({ projectId, onToast }) => {
  const [snap, setSnap] = useState<ProjectContextSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getProjectContext(projectId).then((s) => {
      if (!alive) return;
      setSnap(s);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const rebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const next = await rebuildProjectContext(projectId);
      setSnap(next);
      onToast?.('Project context rebuilt.');
    } catch (err: any) {
      const msg = err?.msg || err?.message || 'Context rebuild failed';
      setError(msg);
      onToast?.(msg);
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <ThemedLoader label="Loading context" />
      </div>
    );
  }

  const isAi = snap?.generatedBy === 'ai';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border ${
              isAi
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {isAi ? <Sparkles className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
            {isAi ? 'AI summary' : 'Fallback summary'}
          </span>
          {snap && (
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              Updated {relTime(snap.updatedAt)} via {snap.trigger.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-40"
        >
          {rebuilding ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 text-indigo-600" />
          )}
          <span>{rebuilding ? 'Summarizing…' : snap ? 'Refresh' : 'Build context'}</span>
        </button>
      </div>

      {rebuilding && (
        <div className="h-1 w-full bg-slate-200 overflow-hidden">
          <div className="h-full w-1/3 bg-indigo-600 animate-pulse" />
        </div>
      )}

      {error && (
        <p className="text-[11px] font-mono text-rose-600 border border-rose-200 bg-rose-50 px-2.5 py-1.5">
          {error}
        </p>
      )}

      {!snap ? (
        <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center border border-slate-200 bg-slate-50">
          No context yet — build it so the assistant is grounded in this project.
        </p>
      ) : (
        <>
          <pre className="whitespace-pre-wrap text-[11px] font-mono text-slate-700 bg-slate-50 border border-slate-200 p-3 max-h-72 overflow-y-auto">
            {snap.text}
          </pre>
          <div className="flex flex-wrap items-center gap-1.5">
            {snap.sources.map((s) => (
              <span
                key={s}
                className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 uppercase"
              >
                {s}
              </span>
            ))}
            <span className="ml-auto text-[10px] font-mono text-slate-400">
              {snap.lineCount} lines · {snap.charCount}/{CHAR_BUDGET} chars
            </span>
          </div>
        </>
      )}
    </div>
  );
};
