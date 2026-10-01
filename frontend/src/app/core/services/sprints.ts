import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { rowsOf, oneOf, safeRead, unwrap } from '@core/http/util';
import { SprintVelocityResponse, TaigaSprint } from '@shared/models';

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

/**
 * The backend stores a sprint as `{ name, start_date, end_date, status,
 * planned_points, completed_points }` — `fromApi` camelCases those to
 * `plannedPoints` / `completedPoints`. `TaigaSprint` speaks `totalPoints` /
 * `isClosed`, and a raw cast left both `undefined`, which blanked the Overview
 * velocity chart and broke active-sprint selection.
 */
function mapSprint(raw: any): TaigaSprint {
  const status = String(raw?.status || '').toLowerCase();
  return {
    ...raw,
    id: raw?.id || '',
    projectId: raw?.projectId || '',
    name: raw?.name || '',
    startDate: raw?.startDate || '',
    endDate: raw?.endDate || '',
    totalPoints: raw?.totalPoints ?? raw?.plannedPoints ?? 0,
    completedPoints: raw?.completedPoints ?? 0,
    isClosed: raw?.isClosed ?? (status === 'closed' || status === 'completed' || status === 'cancelled'),
    taigaMilestoneId: raw?.taigaMilestoneId ?? null,
  };
}

export async function listSprints(projectId: string): Promise<TaigaSprint[]> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/sprints`);
    return rowsOf<any>(res.data).map(mapSprint);
  }, [], 'sprints.list');
}

/**
 * The backend tags one sprint per project as `active` — the "current" sprint.
 * `GET /projects/:id/sprints` may expose it as `active_sprint` (alongside `rows`);
 * when it does not, fall back to the row whose `status` is `active`.
 */
export async function getActiveSprint(projectId: string): Promise<TaigaSprint | null> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/sprints`);
    const dataset = oneOf<{ activeSprint?: TaigaSprint }>(res.data);
    if (dataset?.activeSprint) return mapSprint(dataset.activeSprint);
    const rows = rowsOf<any>(res.data).map(mapSprint);
    return rows.find((sprint) => !sprint.isClosed) ?? rows[0] ?? null;
  }, null, 'sprints.active');
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

export async function getSprintVelocity(
  sprintId: string,
  historyLimit = 8,
): Promise<SprintVelocityResponse | null> {
  return safeRead(async () => {
    const res = await http.get(`/sprints/${sprintId}/velocity`, {
      params: { history_limit: historyLimit },
    });
    return oneOf<SprintVelocityResponse>(res.data);
  }, null, 'sprints.velocity');
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

export async function getSprintComparison(sprintId: string) {
  return safeRead(async () => {
    const raw = await http.get(`/sprints/${sprintId}/comparison`);
    return unwrap<any>(raw.data);
  }, null, 'sprints.comparison');
}

export async function createSprint(body: Partial<TaigaSprint>) {
  const res = await http.post('/sprints', toApi(body));
  return fromApi(res.data);
}
