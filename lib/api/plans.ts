import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import { GeneratePlanInput, GeneratedPlan, SavedPlan } from '@/types';

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
