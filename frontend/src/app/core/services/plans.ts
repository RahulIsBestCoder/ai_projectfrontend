import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { rowsOf, oneOf, safeRead } from '@core/http/util';
import {
  GeneratePlanInput,
  GeneratedPlan,
  SavedPlan,
  PlanExecution,
  ExecutionProgress,
  ExecutionKind,
  PlanTaigaSyncResult,
  PlanTaigaSyncStatus,
} from '@shared/models';

/**
 * AI sprint plan generator — see planimplement.md.
 *
 * Only three routes exist on the backend today:
 *   POST /v1/plans                 -> generate (AI runs synchronously, 5-25s, up to ~90s)
 *   GET  /v1/plans?project_id=...  -> list saved plans
 *   GET  /v1/plans/:id             -> fetch one saved plan
 *
 * There is no PUT / DELETE / generate-sprint-distribution route.
 */

// Generation can take up to ~90s worst case; spec asks for a >=120s client budget.
const GENERATE_TIMEOUT_MS = 120_000;

// A Taiga publish makes one API call per entity (milestone/story/task), so the
// plan can take up to ~2 minutes on a large plan. Never retry automatically.
const TAIGA_SYNC_TIMEOUT_MS = 120_000;

export async function generatePlan(
  input: GeneratePlanInput,
  signal?: AbortSignal,
): Promise<GeneratedPlan> {
  const res = await http.post('/plans', toApi(input), {
    timeout: GENERATE_TIMEOUT_MS,
    signal,
  });
  // dataset = { id, generated_by, model, input, plan }
  return fromApi(res.data) as GeneratedPlan;
}

export async function listPlans(projectId?: string): Promise<SavedPlan[]> {
  return safeRead(
    async () => {
      const res = await http.get('/plans', {
        params: projectId ? { project_id: projectId } : undefined,
      });
      return rowsOf<SavedPlan>(res.data);
    },
    [],
    'plans.list',
  );
}

export async function getPlan(id: string): Promise<SavedPlan | null> {
  return safeRead(
    async () => oneOf<SavedPlan>((await http.get(`/plans/${id}`)).data),
    null,
    'plans.get',
  );
}

// ---------------------------------------------------------------------------
// Execution — POST /accept materialises the plan into a trackable checklist.
// ---------------------------------------------------------------------------

/** Accept a plan → creates execution items. `resync` rebuilds and RESETS progress. */
export async function acceptPlan(
  planId: string,
  resync = false,
): Promise<{ planId: string; status: 'accepted'; itemsCreated: number }> {
  const res = await http.post(`/plans/${planId}/accept${resync ? '?resync=true' : ''}`, {});
  return fromApi(res.data);
}

export async function getPlanExecution(planId: string): Promise<PlanExecution | null> {
  return safeRead(
    async () => {
      const res = await http.get(`/plans/${planId}/execution`);
      const raw = res?.data;
      if (raw == null || raw === '' || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
        return null;
      }

      const d = fromApi(raw);
      if (!d || !d.progress) return null;
      return {
        plan: d.plan,
        progress: d.progress,
        sprints: Array.isArray(d.sprints) ? d.sprints : [],
        milestones: Array.isArray(d.milestones) ? d.milestones : [],
        deadlines: Array.isArray(d.deadlines) ? d.deadlines : [],
      } as PlanExecution;
    },
    null,
    'plans.execution',
  );
}

export async function toggleExecutionItem(
  planId: string,
  kind: ExecutionKind,
  itemId: string,
  isCompleted: boolean,
): Promise<{ itemId: string; kind: ExecutionKind; isCompleted: boolean; progress: ExecutionProgress }> {
  const res = await http.patch(
    `/plans/${planId}/execution/${kind}/${itemId}`,
    toApi({ isCompleted }),
  );
  return fromApi(res.data);
}

// ---------------------------------------------------------------------------
// Taiga publish pipeline — publish approved plans to Taiga (milestones/sprints/stories/tasks).
// ---------------------------------------------------------------------------

/** Dry-run preview: returns create/update/skip counts per stage + missing role mappings. */
export async function previewCreateInTaiga(
  projectId: string,
  planId: string,
  integrationId: string,
) {
  const res = await http.post(
    `/projects/${projectId}/plans/${planId}/publish-to-taiga/preview`,
    toApi({ integrationId }),
  );
  return fromApi(res.data);
}

/** One-shot create: creates Taiga records. */
export async function createInTaiga(
  projectId: string,
  planId: string,
  integrationId: string,
) {
  const res = await http.post(
    `/projects/${projectId}/plans/${planId}/create-in-taiga`,
    toApi({ integrationId }),
  );
  return fromApi(res.data);
}

/** Idempotent publish: creates missing + updates existing Taiga records. */
export async function publishToTaiga(
  projectId: string,
  planId: string,
  integrationId: string,
  opts: { createMissing?: boolean; updateExisting?: boolean } = {},
) {
  const res = await http.post(
    `/projects/${projectId}/plans/${planId}/publish-to-taiga`,
    toApi({
      integrationId,
      createMissing: opts.createMissing !== false,
      updateExisting: opts.updateExisting !== false,
    }),
  );
  return fromApi(res.data);
}

/** Save a Taiga integration (base_url + project_id, token OR username+password). */
export async function connectTaiga(
  projectId: string,
  payload: { baseUrl?: string; base_url?: string; projectId?: number; project_id?: number; token?: string; username?: string; password?: string },
) {
  const res = await http.post(`/projects/${projectId}/taiga/connect`, toApi(payload));
  return fromApi(res.data);
}

/** Test a saved Taiga integration connection. */
export async function testTaigaConnection(projectId: string, integrationId: string) {
  const res = await http.post(
    `/projects/${projectId}/taiga/test-connection`,
    toApi({ integrationId }),
  );
  return fromApi(res.data);
}

/** Get Taiga integration status for a project. */
export async function getTaigaStatus(projectId: string) {
  const res = await http.get(`/projects/${projectId}/taiga/status`);
  return fromApi(res.data);
}

/** Save a role → Taiga user mapping. */
export async function saveTaigaUserMapping(
  projectId: string,
  role: string,
  taigaUserId: number,
) {
  const res = await http.post(
    `/projects/${projectId}/taiga/user-mapping`,
    toApi({ role, taigaUserId }),
  );
  return fromApi(res.data);
}

// ---------------------------------------------------------------------------
// Plan-scoped Taiga sync — the "Create in Taiga" button (preferred path).
//
// The client only sends the plan id: the backend resolves the project and the
// Taiga integration from `ai_plans.project_id`, so no `integrationId` is needed.
// `mode: 'sync'` creates what is missing and updates what is already mapped,
// which makes pressing the button twice safe (the project-scoped helpers above
// fail with ALREADY_EXISTS unless the caller switches to the sync route).
// ---------------------------------------------------------------------------

/** Dry run: the exact diff the confirmation dialog shows. Writes nothing. */
export async function previewPlanTaiga(planId: string): Promise<PlanTaigaSyncResult> {
  const res = await http.post(`/plans/${planId}/create-in-taiga/preview`, toApi({ dryRun: true }));
  return fromApi(res.data) as PlanTaigaSyncResult;
}

/** Create (`create`) or reconcile (`sync`) the plan inside its Taiga project. */
export async function createPlanInTaiga(
  planId: string,
  mode: 'create' | 'sync' = 'create',
  opts: { allowUnassigned?: boolean } = {},
): Promise<PlanTaigaSyncResult> {
  const res = await http.post(
    `/plans/${planId}/create-in-taiga`,
    toApi({ mode, dryRun: false, allowUnassigned: opts.allowUnassigned === true }),
    { timeout: TAIGA_SYNC_TIMEOUT_MS },
  );
  return fromApi(res.data) as PlanTaigaSyncResult;
}

/** Publish state + per-entity mapping summary for the plan (never throws). */
export async function getPlanTaigaSync(planId: string): Promise<PlanTaigaSyncStatus | null> {
  return safeRead(
    async () => oneOf<PlanTaigaSyncStatus>((await http.get(`/plans/${planId}/taiga-sync`)).data),
    null,
    'plans.taigaSync',
  );
}

/** Resume a partial/failed sync: creates missing entities, updates mapped ones. */
export async function retryPlanTaiga(planId: string): Promise<PlanTaigaSyncResult> {
  const res = await http.post(
    `/plans/${planId}/taiga-sync/retry`,
    {},
    { timeout: TAIGA_SYNC_TIMEOUT_MS },
  );
  return fromApi(res.data) as PlanTaigaSyncResult;
}
