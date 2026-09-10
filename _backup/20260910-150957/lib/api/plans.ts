import { http } from './http';
import { fromApi, toApi } from './case';
import { oneOf, safeRead } from './util';
import { Plan, PlanSprint } from '@/types';

export async function getPlan(id: string): Promise<Plan | null> {
  return safeRead(async () => {
    return oneOf<Plan>((await http.get(`/plans/${id}`)).data);
  }, null, 'plans.get');
}

export async function createPlan(body: Partial<Plan>): Promise<Plan> {
  const res = await http.post('/plans', toApi(body));
  return fromApi(res.data);
}

export async function updatePlan(id: string, body: Partial<Plan>) {
  const res = await http.put(`/plans/${id}`, toApi(body));
  return res.data;
}

export async function deletePlan(id: string) {
  const res = await http.delete(`/plans/${id}`);
  return res.data;
}

export async function generateSprintDistribution(id: string): Promise<{ sprints: PlanSprint[] }> {
  const res = await http.post(`/plans/${id}/generate-sprint-distribution`, {});
  const data = fromApi(res.data);
  return { sprints: Array.isArray(data?.sprints) ? data.sprints : [] };
}
