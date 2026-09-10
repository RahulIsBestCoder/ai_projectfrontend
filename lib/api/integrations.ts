import { http, ApiError } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, safeRead } from './util';
import { SyncLog, IntegrationRow, SyncHistoryRow } from '@/types';

/**
 * Live integration routes (verified against the backend):
 *   POST   /v1/integrations                       link a repo/board to a project
 *   GET    /v1/integrations/:id                   fetch one
 *   PUT    /v1/integrations/:id                   update
 *   DELETE /v1/integrations/:id                   unlink (soft delete)
 *   GET    /v1/integrations/:id/sync-history      paginated sync runs + stats
 *   GET    /v1/projects/:projectId/integrations   list a project's integrations
 *
 * NOT built: /integrations/providers, /connect, /disconnect, a sync-trigger,
 * and POST /projects/:id/integrations. Those are handled client-side below.
 */

// No provider-catalog route — the schema accepts these values; the UI shows the
// two that are in product scope.
const PROVIDER_CATALOG: { id: string; name: string; type: string }[] = [
  { id: 'github', name: 'GitHub', type: 'vcs' },
  { id: 'taiga', name: 'Taiga', type: 'work' },
];

export async function getProviderCatalog() {
  return PROVIDER_CATALOG;
}
// Legacy alias kept for the Sync screen
export const listProviders = getProviderCatalog;

export async function listProjectIntegrations(projectId: string): Promise<IntegrationRow[]> {
  return safeRead(
    async () => {
      const res = await http.get(`/projects/${projectId}/integrations`);
      return rowsOf<IntegrationRow>(res.data);
    },
    [],
    'integrations.list',
  );
}

/** Link a provider to a project — POST /v1/integrations. */
export async function connectProjectIntegration(
  projectId: string,
  body: { provider: string; repositoryName: string; repositoryUrl?: string; token?: string },
): Promise<IntegrationRow> {
  const res = await http.post(
    '/integrations',
    toApi({
      projectId,
      provider: body.provider,
      repositoryName: body.repositoryName,
      repositoryUrl: body.repositoryUrl || undefined,
      token: body.token || undefined,
      status: 1,
    }),
  );
  return fromApi(res.data) as IntegrationRow;
}

/** Unlink — DELETE /v1/integrations/:id (the projectId arg is unused, kept for call sites). */
export async function disconnectIntegration(_projectId: string, integrationId: string) {
  const res = await http.delete(`/integrations/${integrationId}`);
  return res.data;
}

export async function updateIntegration(id: string, body: Partial<IntegrationRow>) {
  const res = await http.put(`/integrations/${id}`, toApi(body));
  return res.data;
}

/** Run a sync now — POST /v1/integrations/:id/sync (GitHub: commits + PRs · Taiga: work items + sprints). */
export async function syncIntegration(integrationId: string): Promise<{
  status: string;
  repositoryId?: string;
  itemsSynced?: {
    commits?: number;
    pullRequests?: number;
    workItems?: number;
    sprints?: number;
    total: number;
  };
}> {
  const res = await http.post(`/integrations/${integrationId}/sync`, {}, { timeout: 60_000 });
  return fromApi(res.data);
}

/** One-line summary of a sync result for a toast. */
export function summariseSync(s?: {
  commits?: number;
  pullRequests?: number;
  workItems?: number;
  sprints?: number;
  total?: number;
}): string {
  if (!s) return 'Sync complete';
  const parts: string[] = [];
  if (s.commits != null) parts.push(`${s.commits} commits`);
  if (s.pullRequests != null) parts.push(`${s.pullRequests} PRs`);
  if (s.workItems != null) parts.push(`${s.workItems} work items`);
  if (s.sprints != null) parts.push(`${s.sprints} sprints`);
  return parts.length ? `Synced ${parts.join(', ')}` : `Synced ${s.total ?? 0} items`;
}

export async function getIntegrationSyncHistory(integrationId: string): Promise<SyncHistoryRow[]> {
  return safeRead(
    async () => {
      const res = await http.get(`/integrations/${integrationId}/sync-history`);
      return rowsOf<SyncHistoryRow>(res.data);
    },
    [],
    'integrations.syncHistory',
  );
}

/**
 * No global sync-history route — history is per integration. When a projectId is
 * known we aggregate across that project's integrations; otherwise empty.
 */
export async function getSyncLogs(
  projectId?: string,
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
              timestamp: r.createdAt,
              status: (r.status || '').toUpperCase() as SyncLog['status'],
              message: `${i.repositoryName}: ${r.status}${
                r.errorMessage ? ` — ${r.errorMessage}` : ` (${r.itemsSynced ?? 0} items)`
              }`,
              recordsSynced: { commits: 0, prs: 0, stories: 0, tasks: 0 },
            })),
          ),
        ),
      );
      const logs = histories.flat().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      return { logs, lastSync: logs[0]?.timestamp || null };
    },
    { logs: [], lastSync: null },
    'integrations.history',
  );
}

/** There is no sync-trigger route. Kept so the Navbar "sync" button fails gracefully. */
export async function triggerSync(_action?: string, _projectId?: string): Promise<never> {
  throw new ApiError('The backend does not expose a sync-trigger endpoint yet.');
}
