import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { rowsOf, oneOf, safeRead } from '@core/http/util';
import { Department, DepartmentMetrics } from '@shared/models';

/** The backend requires `project_id` (400 without it), so no request is sent until a project is selected. */
export async function listDepartments(organizationId: string, projectId?: string): Promise<Department[]> {
  if (!projectId) return [];
  return safeRead(async () => {
    const res = await http.get('/departments', {
      params: { organization_id: organizationId, project_id: projectId },
    });
    return rowsOf<Department>(res.data);
  }, [], 'departments.list');
}

export async function getDepartment(id: string): Promise<Department | null> {
  return safeRead(async () => {
    return oneOf<Department>((await http.get(`/departments/${id}`)).data);
  }, null, 'departments.get');
}

export async function createDepartment(body: Partial<Department>): Promise<Department> {
  const res = await http.post('/departments', toApi(body));
  return fromApi(res.data);
}

export async function updateDepartment(id: string, body: Partial<Department>) {
  const res = await http.put(`/departments/${id}`, toApi(body));
  return res.data;
}

export async function deleteDepartment(id: string) {
  const res = await http.delete(`/departments/${id}`);
  return res.data;
}

/* ===================== Departments by repository type ===================== */
// Keys stay snake_case exactly as the backend sends them: `fromApi` would
// camelCase map keys such as repository names in `teams` and statuses in `by_status`.

/** Repository types (`ui`, `backend`, `apps`, `shared`, `other`) plus backend-added groups such as QA. */
export type RepoDepartmentId = string;

export interface RepoDepartmentRepository {
  id: string;
  name: string | null;
  linked: boolean;
  project_id: string;
  project_name: string | null;
}

export interface QaEfficiency { method: 'reported_item_closure_rate'; reported:number; closed:number; percent:number|null }
export interface RepoDepartmentEmployee {
  tasks?:{created:number;closed:number};
  reporting_role?: 'qa'|'manager'|'mixed';
  efficiency_eligible?:boolean;
  efficiency?:QaEfficiency|null;
  issues?:{reported:number;open:number;closed:number;last_reported_at:string|null};
  /** Stable key, e.g. "login:sougata-mass" — one person can have several emails. */
  id: string;
  user_id: string | null;
  name: string;
  login: string | null;
  email: string | null;
  emails: string[];
  role: string | null;
  commits: number;
  additions: number;
  deletions: number;
  first_commit_at: string | null;
  last_commit_at: string | null;
  active: boolean;
  repositories: string[];
  projects: { id: string; name: string | null }[];
}

export interface RepoDepartment {
  tasks?:{created:number;closed:number};
  issue_count?:number;
  efficiency?:QaEfficiency;
  id: RepoDepartmentId;
  name: string;
  color: string;
  description: string;
  member_count: number;
  active_count: number;
  commit_count: number;
  additions: number;
  deletions: number;
  teams: string[];
  repositories: RepoDepartmentRepository[];
  employees: RepoDepartmentEmployee[];
}

export interface RepoDepartmentsResponse {
  rows: RepoDepartment[];
  count: number;
  total_employees: number;
  unlinked_repository_count: number;
  active_window_days: number;
  source: string;
  organization_id: string | null;
}

export interface RepoDepartmentMetrics {
  tasks?:{created:number;closed:number};
  issues?:{total:number;open:number;closed:number};
  efficiency?:QaEfficiency;
  department_id: string;
  name: string;
  color: string;
  headcount: number;
  active_count: number;
  roles: Record<string, number>;
  /** Repository name → contributor count. */
  teams: Record<string, number>;
  projects: { count: number; rows: { _id: string; name: string | null }[] };
  commits: { total: number; additions: number; deletions: number };
  repositories: RepoDepartmentRepository[];
  employees: RepoDepartmentEmployee[];
  work_items: { total: number; total_points: number; by_status: Record<string, { count: number; points: number }> };
}

const NO_CACHE = { 'Cache-Control': 'no-cache' };

/**
 * GET /departments?organization_id=&project_id= — the backend requires the selected
 * project (400 without it). Throws on failure so the UI can offer Retry.
 */
export async function getRepositoryDepartments(
  organizationId: string,
  projectId: string
): Promise<RepoDepartmentsResponse> {
  if (!projectId) throw new Error('Select a project to see its departments.');
  const res = await http.get('/departments', {
    params: { organization_id: organizationId, project_id: projectId },
    headers: NO_CACHE,
  });
  const data = res.data as Partial<RepoDepartmentsResponse> | null;
  return {
    rows: Array.isArray(data?.rows) ? data!.rows : [],
    count: Number(data?.count ?? data?.rows?.length ?? 0),
    total_employees: Number(data?.total_employees ?? 0),
    unlinked_repository_count: Number(data?.unlinked_repository_count ?? 0),
    active_window_days: Number(data?.active_window_days ?? 30),
    source: String(data?.source ?? ''),
    organization_id: data?.organization_id ?? null,
  };
}

/** GET /departments/:id/metrics?organization_id=&project_id= — scoped to the organization and selected project. */
export async function getRepositoryDepartmentMetrics(
  departmentId: string,
  organizationId: string,
  projectId: string
): Promise<RepoDepartmentMetrics> {
  if (!departmentId) throw new Error('Department id is required.');
  if (!projectId) throw new Error('Select a project to see department details.');
  const res = await http.get(`/departments/${encodeURIComponent(departmentId)}/metrics`, {
    params: { organization_id: organizationId, project_id: projectId },
    headers: NO_CACHE,
  });
  return res.data as RepoDepartmentMetrics;
}

/**
 * Work-item summary for one department, scoped to the selected project. Adapts the
 * backend's `work_items.by_status` shape to `DepartmentMetrics`.
 */
export async function getDepartmentMetrics(
  id: string,
  projectId?: string,
  organizationId?: string
): Promise<DepartmentMetrics | null> {
  if (!id || !projectId) return null;
  return safeRead(async () => {
    const res = await http.get(`/departments/${encodeURIComponent(id)}/metrics`, {
      params: { project_id: projectId, ...(organizationId ? { organization_id: organizationId } : {}) },
    });
    // Raw keys: `fromApi` would camelCase status keys such as `in_progress`.
    const raw: any = res.data;
    if (typeof raw?.totalItems === 'number' || typeof raw?.total_items === 'number') {
      return fromApi(raw) as DepartmentMetrics;
    }
    const workItems = raw?.work_items;
    if (!workItems || typeof workItems.total !== 'number') return null;
    const byStatus: Record<string, { count?: number; points?: number }> = workItems.by_status || {};
    const statusBreakdown = Object.fromEntries(
      Object.entries(byStatus).map(([status, value]) => [status, Number(value?.count ?? 0)])
    );
    const done = byStatus.done || {};
    return {
      departmentId: String(raw.department_id ?? id),
      totalItems: workItems.total,
      statusBreakdown,
      completionRate: workItems.total ? Math.round((Number(done.count ?? 0) / workItems.total) * 100) : 0,
      plannedPoints: Number(workItems.total_points ?? 0),
      completedPoints: Number(done.points ?? 0),
    };
  }, null, 'departments.metrics');
}

/** Classification affects only this project's QA reporting, never account permissions. */
export async function setQaReporterRole(projectId:string, reporterId:string, reportingRole:'qa'|'manager') {
  await http.put('/projects/'+encodeURIComponent(projectId)+'/qa-reporters/'+encodeURIComponent(reporterId)+'/role', {reporting_role:reportingRole});
}
