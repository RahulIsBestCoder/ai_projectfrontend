import { PlanDraftRecord } from '@shared/models';

/**
 * Per-project "edited plan draft" store.
 *
 * The backend has no plan-update route, so the edits a user makes to a
 * generated (or blank / last-AI) plan would be lost on refresh, project
 * switch, or browser close. "Save draft" persists them here so they can be
 * resumed later. Mirrors the `acceptedPlan.ts` pattern — localStorage keyed by
 * project id, all access try/catch-guarded (quota / disabled storage is
 * non-fatal). One draft per project: saving overwrites the previous one.
 */

const key = (projectId: string) => `aipi_plan_draft:${projectId}`;

export function getPlanDraft(projectId: string): PlanDraftRecord | null {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.plan && Array.isArray(parsed.plan.sprints)) {
      return parsed as PlanDraftRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePlanDraft(projectId: string, record: PlanDraftRecord): void {
  if (!projectId) return;
  try {
    localStorage.setItem(key(projectId), JSON.stringify(record));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

export function clearPlanDraft(projectId: string): void {
  if (!projectId) return;
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    /* non-fatal */
  }
}