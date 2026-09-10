import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import { Project } from '@/types';

export const deriveDeliveryStatus = (
  healthScore = 100,
  delayProbability = 0
): 'ON_TRACK' | 'AT_RISK' | 'DELAYED' => {
  if (delayProbability >= 60 || healthScore < 50) return 'DELAYED';
  if (delayProbability >= 30 || healthScore < 75) return 'AT_RISK';
  return 'ON_TRACK';
};

// Backend `projects.status` is a NUMBER (1 = active, default 1). The UI works in
// the delivery-status vocabulary. Map both ways so we never send a string the
// Mongoose schema will reject, and never render a raw number.
const STATUS_STRING_TO_NUM: Record<string, number> = {
  active: 1,
  on_hold: 2,
  completed: 3,
  archived: 4,
  cancelled: 5,
  ON_TRACK: 1,
  AT_RISK: 2,
  DELAYED: 2,
};

function normalizeOutgoingStatus(body: Record<string, any>): Record<string, any> {
  if (body == null || body.status === undefined) return body;
  const s = body.status;
  if (typeof s === 'number') return body;
  const mapped = STATUS_STRING_TO_NUM[String(s)];
  if (mapped === undefined) {
    // unknown value — drop it rather than trigger a server CastError
    const rest = { ...body };
    delete rest.status;
    return rest;
  }
  return { ...body, status: mapped };
}

function deliveryFromBackend(raw: any): 'ON_TRACK' | 'AT_RISK' | 'DELAYED' {
  const s = raw?.status;
  if (typeof s === 'string') {
    if (['DELAYED', 'AT_RISK', 'ON_TRACK'].includes(s)) return s as any;
    if (s === 'on_hold' || s === 'cancelled' || s === 'archived') return 'DELAYED';
    return 'ON_TRACK';
  }
  return 'ON_TRACK';
}

async function safeOne<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function getProjectRaw(id: string) {
  return oneOf<any>((await http.get(`/projects/${id}`)).data);
}

export async function createProject(
  body: Partial<Project> & { ownerId?: string; organizationId?: string },
) {
  // Backend requires name + organization_id + owner_id (frontend-plan.md §3.2).
  const res = await http.post('/projects', normalizeOutgoingStatus(toApi(body)));
  return fromApi(res.data);
}

export async function updateProject(id: string, body: Partial<Project>) {
  const res = await http.put(`/projects/${id}`, normalizeOutgoingStatus(toApi(body)));
  return res.data;
}

export async function deleteProject(id: string) {
  const res = await http.delete(`/projects/${id}`);
  return res.data;
}

export async function listProjects(): Promise<Project[]> {
  return safeRead(
    async () => {
      const res = await http.get('/projects');
      return rowsOf<any>(res.data).map((raw) => ({
        ...raw,
        id: raw.id,
        healthScore: raw.healthScore ?? 0,
        delayProbability: raw.delayProbability ?? 0,
        status: deliveryFromBackend(raw),
        keyRiskFactors: Array.isArray(raw.keyRiskFactors) ? raw.keyRiskFactors : [],
        deadline: raw.deadline || null,
        lastSyncAt: raw.lastSyncAt || null,
      })) as Project[];
    },
    [],
    'projects.list'
  );
}

/** Compose the workspace "Project" the UI expects from /projects/:id + health + risks + predictions. */
export async function getProject(id: string): Promise<Project | null> {
  const [raw, health, risks, pred] = await Promise.all([
    safeOne(() => getProjectRaw(id)),
    safeOne(() => http.get(`/projects/${id}/health`).then((r) => oneOf<any>(r.data))),
    safeOne(() => http.get(`/projects/${id}/risks`).then((r) => rowsOf(r.data))),
    safeOne(() => http.get(`/projects/${id}/predictions`).then((r) => oneOf<any>(r.data))),
  ]);

  if (!raw) return null;

  const hasHealth = health && typeof health.score === 'number';
  const healthScore = hasHealth ? health.score : (raw.healthScore ?? 0);
  const delayProbability =
    pred?.delayProbability ??
    (typeof pred?.confidence === 'number' ? pred.confidence : undefined) ??
    raw.delayProbability ??
    0;
  const keyRiskFactors = Array.isArray(risks)
    ? risks.map((r: any) => r.description || r.riskType).filter(Boolean)
    : raw.keyRiskFactors || [];

  return {
    ...raw,
    id: raw.id || id,
    healthScore,
    delayProbability,
    // only derive when we actually have signal; otherwise reflect backend status
    status: hasHealth || pred ? deriveDeliveryStatus(healthScore, delayProbability) : deliveryFromBackend(raw),
    keyRiskFactors,
    deadline: raw.deadline || null,
    lastSyncAt: raw.lastSyncAt || null,
  };
}
