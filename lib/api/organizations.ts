import { http } from './http';
import { fromApi, toApi } from './case';
import { mapEnum, ENUM } from './enums';
import { rowsOf, oneOf, safeRead } from './util';
import { Organization, OrgMember, Team, Employee } from '@/types';

export async function listOrganizations(): Promise<Organization[]> {
  return safeRead(async () => {
    const res = await http.get('/organizations');
    return rowsOf<Organization>(res.data);
  }, [], 'org.list');
}

export async function getOrgSettings(orgId: string): Promise<Record<string, string>> {
  return safeRead(async () => {
    const d = oneOf<Record<string, string>>((await http.get(`/organizations/${orgId}/settings`)).data);
    return d && !Array.isArray(d) ? d : {};
  }, {}, 'org.settings');
}

export async function updateOrgSettings(orgId: string, settings: Record<string, string>) {
  const res = await http.put(`/organizations/${orgId}/settings`, settings);
  return res.data;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  return safeRead(async () => {
    const res = await http.get(`/organizations/${orgId}/members`);
    return rowsOf<OrgMember>(res.data);
  }, [], 'org.members');
}

export async function addOrgMember(orgId: string, email: string, role: string) {
  const res = await http.post(`/organizations/${orgId}/members`, {
    email,
    role: mapEnum(ENUM.role.toApi, role, role),
  });
  return fromApi(res.data);
}

export async function removeOrgMember(orgId: string, userId: string) {
  const res = await http.delete(`/organizations/${orgId}/members/${userId}`);
  return res.data;
}

export async function listTeams(): Promise<Team[]> {
  return safeRead(async () => {
    const res = await http.get('/teams');
    return rowsOf<Team>(res.data);
  }, [], 'teams.list');
}

export async function createTeam(body: Partial<Team>): Promise<Team> {
  const res = await http.post('/teams', toApi(body));
  return fromApi(res.data);
}

export async function deleteTeam(id: string) {
  const res = await http.delete(`/teams/${id}`);
  return res.data;
}

export async function listEmployees(): Promise<Employee[]> {
  return safeRead(async () => {
    const res = await http.get('/employees');
    return rowsOf<Employee>(res.data);
  }, [], 'employees.list');
}
