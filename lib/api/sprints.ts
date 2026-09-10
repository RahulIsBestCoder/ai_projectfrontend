import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import { TaigaSprint } from '@/types';

/** Unwrap a chart series that may arrive bare, as `{rows}`, or wrapped under a
 *  named key (e.g. `{ sprint, burndown: [...] }`, `{ series: [...] }`). */
function seriesOf(data: any, ...keys: string[]): any[] {
  const d = fromApi(data);
  if (Array.isArray(d)) return d;
  for (const k of [...keys, 'series', 'rows', 'data']) {
    if (d && Array.isArray(d[k])) return d[k];
  }
  return [];
}

export async function listSprints(projectId: string): Promise<TaigaSprint[]> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/sprints`);
    return rowsOf<TaigaSprint>(res.data);
  }, [], 'sprints.list');
}

export async function getSprintBurndown(sprintId: string) {
  return safeRead(async () => {
    const res = await http.get(`/sprints/${sprintId}/burndown`);
    return seriesOf(res.data, 'burndown');
  }, [], 'sprints.burndown');
}

export async function getSprintBurnup(sprintId: string) {
  return safeRead(async () => {
    const res = await http.get(`/sprints/${sprintId}/burnup`);
    return seriesOf(res.data, 'burnup');
  }, [], 'sprints.burnup');
}

export async function getSprintVelocity(sprintId: string) {
  return safeRead(async () => {
    const res = await http.get(`/sprints/${sprintId}/velocity`);
    return seriesOf(res.data, 'velocity');
  }, [], 'sprints.velocity');
}

export async function getSprintSummary(sprintId: string) {
  return safeRead(async () => {
    return oneOf((await http.get(`/sprints/${sprintId}/summary`)).data);
  }, null, 'sprints.summary');
}

export async function getSprintRetrospective(sprintId: string): Promise<{ notes: string }> {
  return safeRead(async () => {
    const d = oneOf<any>((await http.get(`/sprints/${sprintId}/retrospective`)).data);
    return { notes: d?.notes || '' };
  }, { notes: '' }, 'sprints.retro');
}

export async function createSprint(body: Partial<TaigaSprint>) {
  const res = await http.post('/sprints', toApi(body));
  return fromApi(res.data);
}
