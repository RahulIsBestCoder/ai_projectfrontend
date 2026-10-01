import { http, ApiError } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { rowsOf, safeRead } from '@core/http/util';
import { SyncLog, IntegrationRow, SyncHistoryRow, RepoCategoryOption } from '@shared/models';

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

/**
 * Link a provider to a project — POST /v1/integrations.
 *
 * Taiga auth: the backend reads `username`/`password` off the integration document
 * and, when no `token` is stored yet, calls `POST /auth` on first sync to obtain and
 * cache a Taiga API token (`auth_token`). Sending both here makes a fresh Taiga link
 * sync-able immediately.
 */
export async function connectProjectIntegration(
  projectId: string,
  body: {
    provider: string;
    repositoryName: string;
    repositoryUrl?: string;
    username?: string;
    password?: string;
    token?: string;
    /** Git branch to sync (GitHub). Omit/empty = repo default branch. */
    branch?: string;
    /** Team/purpose dropdown: ui | backend | apps | shared | other. */
    category?: string;
  },
): Promise<IntegrationRow> {
  const res = await http.post(
    '/integrations',
    toApi({
      projectId,
      provider: body.provider,
      repositoryName: body.repositoryName,
      repositoryUrl: body.repositoryUrl || undefined,
      username: body.username || undefined,
      password: body.password || undefined,
      token: body.token || undefined,
      branch: body.branch?.trim() || undefined,
      category: body.category || undefined,
      status: 1,
    }),
  );
  return fromApi(res.data) as IntegrationRow;
}

/**
 * Fallback when the categories endpoint is unreachable — mirrors the backend
 * catalog (git_intelligence_interface.ts) so the dropdown always renders.
 */
export const FALLBACK_REPO_CATEGORIES: RepoCategoryOption[] = [
  { value: 'ui', label: 'UI Team', color: '#8b5cf6', description: 'Frontend / UI team repository' },
  { value: 'backend', label: 'Backend', color: '#3b82f6', description: 'Backend / API team repository' },
  { value: 'apps', label: 'Apps', color: '#22c55e', description: 'Mobile / desktop apps repository' },
  { value: 'shared', label: 'Shared', color: '#f59e0b', description: 'Shared libraries / packages' },
  { value: 'other', label: 'Other', color: '#6b7280', description: 'Everything else' },
];

/** Dropdown options for "what is this repo for" — GET /v1/git_intelligence/categories. */
export async function getRepoCategories(): Promise<RepoCategoryOption[]> {
  return safeRead(
    async () => {
      const res = await http.get('/git_intelligence/categories');
      const d = fromApi(res.data);
      const cats = d?.categories || d?.dataset?.categories;
      return Array.isArray(cats) && cats.length ? cats : FALLBACK_REPO_CATEGORIES;
    },
    FALLBACK_REPO_CATEGORIES,
    'integrations.categories',
  );
}

/**
 * Branch options for the connect wizard / edit panel —
 * POST /v1/integrations/:id/branches. Pass an integrationId for a linked
 * repo, or (preview mode) the repo + token typed in the wizard.
 */
export async function listIntegrationBranches(args: {
  integrationId: string;
  token?: string;
}): Promise<{ branches: { name: string; protected: boolean }[]; defaultBranch?: string | null }> {
  const body: Record<string, unknown> = {};
  // Token goes in the POST body (never the URL). Omitted when empty so the
  // backend falls back to the stored integration token.
  if (args.token?.trim()) body.token = args.token.trim();
  const res = await http.post(`/integrations/${args.integrationId}/branches`, toApi(body), { timeout: 30_000 });
  const d = fromApi(res.data) as any;
  return {
    branches: Array.isArray(d?.branches) ? d.branches : [],
    defaultBranch: d?.defaultBranch ?? d?.default_branch ?? null,
  };
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

/** One sync-run result. Naming follows the backend dataset (converted by `fromApi`). */
export interface SyncResult {
  status: string;
  repositoryId?: string;
  /** Branch the commit list was fetched for (git only). Fallback: integrations list `branch`. */
  syncBranch?: string;
  /** This run — what was just fetched. `pullRequestsForBranch` = PRs touching the branch. */
  itemsSynced?: {
    commits?: number;
    pullRequests?: number;
    pullRequestsForBranch?: number;
    workItems?: number;
    sprints?: number;
    total: number;
  };
  /** Stored repo totals (countDocuments) — stable across `no_changes` re-syncs. */
  totals?: { commits?: number; pullRequests?: number; total?: number };
  sourceSync?: {
    branch?: string;
    mode?: 'initial' | 'incremental' | 'reconcile' | 'no_changes';
    previousCommitSha?: string;
    currentCommitSha?: string;
  };
}

/** Run a sync now — POST /v1/integrations/:id/sync (GitHub: commits + PRs · Taiga: work items + sprints). */
export async function syncIntegration(integrationId: string): Promise<SyncResult> {
  const res = await http.post(`/integrations/${integrationId}/sync`, {}, { timeout: 60_000 });
  return fromApi(res.data) as SyncResult;
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

/**
 * Aggregate the workspace's connected integrations across the org's projects.
 * The backend exposes no org-scoped list route, so we fan out over
 * `GET /v1/projects/:id/integrations` and dedupe by integration id
 * (Settings → "Connected workspace integrations").
 */
export async function listWorkspaceIntegrations(projectIds: string[]): Promise<IntegrationRow[]> {
  if (!projectIds.length) return [];
  const lists = await Promise.all(
    projectIds.map((id) => safeRead(() => listProjectIntegrations(id), [], 'integrations.list')),
  );
  const seen = new Set<string>();
  const out: IntegrationRow[] = [];
  for (const row of lists.flat()) {
    const key = row.id || `${row.provider}:${row.repositoryName}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
