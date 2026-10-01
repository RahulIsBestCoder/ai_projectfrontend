'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Check, Loader2 } from 'lucide-react';

interface StageCounts {
  create?: number;
  update?: number;
  skip?: number;
  skipped?: number;
  created?: number;
  updated?: number;
  failed?: number;
}

interface SyncWarning {
  sourceId?: string;
  type?: string;
  value?: string;
}

interface SyncError {
  sourceId?: string;
  entityType?: string;
  field?: string;
  error?: string;
}

interface PreviewData {
  /** Documented envelope from POST /v1/plans/:planId/create-in-taiga/preview. */
  summary?: { milestones?: StageCounts; userStories?: StageCounts; tasks?: StageCounts };
  warnings?: SyncWarning[];
  errors?: SyncError[];
  mode?: 'create' | 'sync';
  dryRun?: boolean;
  taigaProject?: { id?: number | null; slug?: string; name?: string | null } | null;
  /** Legacy preview shape the backend still returns alongside the envelope. */
  milestones?: StageCounts;
  sprints?: StageCounts;
  user_stories?: StageCounts;
  tasks?: StageCounts;
  missing_assignee_mappings?: string[];
  missingAssigneeMappings?: string[];
}

interface TaigaPreviewModalProps {
  open: boolean;
  preview: PreviewData | null;
  publishing: boolean;
  error: string | null;
  onClose: () => void;
  /** `allowUnassigned` lets the run create items whose role has no Taiga user. */
  onConfirm: (allowUnassigned: boolean) => void;
}

/**
 * Rows shown in the dialog. Sprint-level mapping: the milestone and the user
 * story are 1:1 with a sprint, so the two counters normally match.
 */
const STAGE_ROWS: Array<{
  label: string;
  summaryKey: 'milestones' | 'userStories' | 'tasks';
  legacyKey: 'milestones' | 'sprints' | 'user_stories' | 'tasks';
}> = [
  { label: 'Milestones', summaryKey: 'milestones', legacyKey: 'milestones' },
  { label: 'User Stories', summaryKey: 'userStories', legacyKey: 'user_stories' },
  { label: 'Tasks', summaryKey: 'tasks', legacyKey: 'tasks' },
];

const StageCard: React.FC<{ label: string; counts: StageCounts | undefined }> = ({ label, counts }) => {
  const create = counts?.create ?? counts?.created ?? 0;
  const update = counts?.update ?? counts?.updated ?? 0;
  const skip = counts?.skip ?? counts?.skipped ?? 0;
  const failed = counts?.failed ?? 0;
  return (
    <div className="p-3 bg-white border border-slate-200 flex items-center justify-between">
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <div className="flex items-center space-x-3 text-[11px] font-mono">
        <span className="text-emerald-700">create {create}</span>
        <span className="text-indigo-700">update {update}</span>
        <span className="text-slate-500">skip {skip}</span>
        {failed > 0 && <span className="text-rose-700">failed {failed}</span>}
      </div>
    </div>
  );
};

export const TaigaPreviewModal: React.FC<TaigaPreviewModalProps> = ({
  open,
  preview,
  publishing,
  error,
  onClose,
  onConfirm,
}) => {
  const [allowUnassigned, setAllowUnassigned] = useState(false);

  if (!open) return null;

  /** Prefer the documented `summary` envelope, fall back to the legacy keys. */
  const countsFor = (
    summaryKey: 'milestones' | 'userStories' | 'tasks',
    legacyKey: string,
  ): StageCounts | undefined =>
    preview?.summary?.[summaryKey] ?? ((preview as any)?.[legacyKey] as StageCounts | undefined);

  const missingRoles = Array.from(
    new Set([
      ...(preview?.warnings ?? [])
        .filter((w) => w.type === 'USER_ROLE_UNMAPPED')
        .map((w) => w.value || w.sourceId || 'unknown role'),
      ...(preview?.missingAssigneeMappings ?? preview?.missing_assignee_mappings ?? []),
    ]),
  );
  const entityErrors = preview?.errors ?? [];
  const isSync = preview?.mode === 'sync';
  const confirmLabel = isSync ? 'Sync to Taiga' : 'Create in Taiga';
  const project = preview?.taigaProject;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white border-2 border-slate-900 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
            {isSync ? 'Sync to Taiga — Preview' : 'Create in Taiga — Preview'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!preview ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading preview…
            </div>
          ) : (
            <>
              <p className="text-[11px] font-mono text-slate-600">
                {isSync
                  ? 'Reconciles the plan in Taiga: creates what is missing, updates what is already mapped.'
                  : "Creates the plan in Taiga: 1 milestone + 1 user story per sprint, with that sprint's tasks under the story."}
              </p>

              {project && (
                <p className="text-[11px] font-mono text-slate-500">
                  Target:{' '}
                  <span className="font-bold text-slate-800">{project.name || project.slug}</span>
                  {project.slug ? ` (${project.slug})` : ''}
                  {preview.dryRun ? ' · nothing is written until you confirm' : ''}
                </p>
              )}

              <div className="space-y-2">
                {STAGE_ROWS.map((row) => (
                  <StageCard
                    key={row.summaryKey}
                    label={row.label}
                    counts={countsFor(row.summaryKey, row.legacyKey)}
                  />
                ))}
              </div>

              {missingRoles.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold block mb-1">No Taiga user mapped to:</span>
                    <span className="font-mono">{missingRoles.join(', ')}</span>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowUnassigned}
                        onChange={(e) => setAllowUnassigned(e.target.checked)}
                        className="accent-amber-600 w-3.5 h-3.5"
                      />
                      <span className="text-amber-800">Create these items unassigned</span>
                    </label>
                    <span className="block mt-1 text-amber-700">
                      Leave it unchecked to fail on those items so the roles can be mapped first.
                    </span>
                  </div>
                </div>
              )}

              {entityErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 space-y-1">
                  <span className="text-xs font-bold text-rose-800 block">Blocking problems:</span>
                  {entityErrors.slice(0, 8).map((e, i) => (
                    <div key={`${e.sourceId}-${i}`} className="text-[11px] font-mono text-rose-700">
                      {e.sourceId || e.entityType}
                      {e.field ? ` · ${e.field}` : ''} — {e.error}
                    </div>
                  ))}
                  {entityErrors.length > 8 && (
                    <div className="text-[10px] font-mono text-rose-600">
                      +{entityErrors.length - 8} more
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-xs font-mono text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border border-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(allowUnassigned)}
            disabled={publishing || entityErrors.length > 0}
            title={entityErrors.length > 0 ? 'Resolve the blocking problems first' : confirmLabel}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider border border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isSync ? 'Syncing…' : 'Creating…'}</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
