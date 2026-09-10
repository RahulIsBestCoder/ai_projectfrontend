import { http } from './http';
import { fromApi, toApi } from './case';
import { ApiError } from './http';
import { rowsOf, safeRead } from './util';
import { SyncLog, IntegrationRow, SyncHistoryRow } from '@/types';

export async function getProviderCatalog() {
  return safeRead(async () => {
    const res = await http.get('/integrations/providers');
    return rowsOf(res.data);
  }, [], 'integrations.providers');
}

// Legacy alias kept for the Sync screen
export const listProviders = getProviderCatalog;

/**
 * The API has no global sync-history route — history is per integration
 * (`GET /v1/integrations/:id/sync-history`). When a projectId is known we
 * aggregate across that project's connected integrations; otherwise empty.
 */
export async function getSyncLogs(
  projectId?: string
): Promise<{ logs: SyncLog[]; lastSync: string | null }> {
  if (!projectId) return { logs: [], lastSync: null };
  return safeRead(
    async () => {
      const integrations = await listProjectIntegrations(projectId);
      const histories = await Promise.all(
        integrations.map((i) =>
          getIntegrationSyncHistory(i.id).then((rows) =>
            rows.map((r, idx) => ({
              id: `${i.id}-${idx}`,
              timestamp: r.syncedAt,
              status: (r.status || '').toUpperCase() as SyncLog['status'],
              message: `${i.repositoryName}: ${r.message}`,
              recordsSynced: { commits: 0, prs: 0, stories: 0, tasks: 0 },
            }))
          )
        )
      );
      const logs = histories
        .flat()
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      return { logs, lastSync: logs[0]?.timestamp || null };
    },
    { logs: [], lastSync: null },
    'integrations.history'
  );
}

/**
 * No global sync trigger exists. Sync must be run against one integration
 * (`POST /v1/integrations/:id/sync`) — see the Integrations screen.
 */
export async function triggerSync(_action?: string, _projectId?: string): Promise<never> {
  throw new ApiError(
    'No global sync endpoint — run "Sync now" per integration on the Integrations screen.'
  );
}

export async function listProjectIntegrations(projectId: string): Promise<IntegrationRow[]> {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/integrations`);
    return rowsOf<IntegrationRow>(res.data);
  }, [], 'integrations.list');
}

export async function connectProjectIntegration(
  projectId: string,
  body: { provider: string; repositoryName: string; token?: string }
): Promise<IntegrationRow> {
  const res = await http.post(`/projects/${projectId}/integrations`, toApi(body));
  const created = fromApi(res.data);
  if (created?.id) {
    await http.post(`/integrations/${created.id}/connect`, {}).catch(() => undefined);
  }
  return created;
}

export async function disconnectIntegration(_projectId: string, integrationId: string) {
  const res = await http.post(`/integrations/${integrationId}/disconnect`, {});
  return res.data;
}

export async function syncIntegration(integrationId: string): Promise<{ jobId: string; status: string }> {
  const res = await http.post(`/integrations/${integrationId}/sync`, {});
  return fromApi(res.data);
}

export async function getIntegrationSyncHistory(integrationId: string): Promise<SyncHistoryRow[]> {
  return safeRead(async () => {
    const res = await http.get(`/integrations/${integrationId}/sync-history`);
    return rowsOf<SyncHistoryRow>(res.data);
  }, [], 'integrations.syncHistory');
}
