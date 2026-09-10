import { AcceptedPlanRecord } from '@/types';

/**
 * Per-project "accepted plan" store.
 *
 * The backend `/v1/plans` endpoint always runs the AI, has no plan-status
 * field, and offers no way to persist a hand-authored plan. Until that lands,
 * the plan a team commits to (AI-generated + edited, or built manually) lives
 * in the browser, keyed by project id.
 */

const key = (projectId: string) => `aipi_plan:${projectId}`;

export function getAcceptedPlan(projectId: string): AcceptedPlanRecord | null {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.plan && Array.isArray(parsed.plan.sprints)) {
      return parsed as AcceptedPlanRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAcceptedPlan(projectId: string, record: AcceptedPlanRecord): void {
  if (!projectId) return;
  try {
    localStorage.setItem(key(projectId), JSON.stringify(record));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

export function clearAcceptedPlan(projectId: string): void {
  if (!projectId) return;
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ *
 * Hidden plans — the backend has no DELETE /v1/plans/:id, so removing
 * a plan from the "Previous plans" list is a per-browser dismissal.
 * ------------------------------------------------------------------ */

const hiddenKey = (projectId: string) => `aipi_plan_hidden:${projectId}`;

export function getHiddenPlanIds(projectId: string): Set<string> {
  if (!projectId) return new Set();
  try {
    const raw = localStorage.getItem(hiddenKey(projectId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function hidePlanId(projectId: string, id: string): void {
  if (!projectId || !id) return;
  try {
    const set = getHiddenPlanIds(projectId);
    set.add(id);
    localStorage.setItem(hiddenKey(projectId), JSON.stringify([...set]));
  } catch {
    /* non-fatal */
  }
}

export function unhidePlanId(projectId: string, id: string): void {
  if (!projectId || !id) return;
  try {
    const set = getHiddenPlanIds(projectId);
    set.delete(id);
    localStorage.setItem(hiddenKey(projectId), JSON.stringify([...set]));
  } catch {
    /* non-fatal */
  }
}
