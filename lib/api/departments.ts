import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, oneOf, safeRead } from './util';
import { Department, DepartmentMetrics } from '@/types';

export async function listDepartments(organizationId: string): Promise<Department[]> {
  return safeRead(async () => {
    const res = await http.get(`/departments?organization_id=${organizationId}`);
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

export async function getDepartmentMetrics(id: string): Promise<DepartmentMetrics | null> {
  return safeRead(async () => {
    const d = oneOf<any>((await http.get(`/departments/${id}/metrics`)).data);
    if (!d || typeof d.totalItems !== 'number') return null;
    return d as DepartmentMetrics;
  }, null, 'departments.metrics');
}
