import { http } from '@core/http/http';
import { fromApi } from '@core/http/case';
import { ENUM, mapEnum } from '@core/http/enums';
import { rowsOf, oneOf, safeRead } from '@core/http/util';
import { GitHubRepository, GitHubCommit, GitHubPullRequest, GitHubContributor } from '@shared/models';

const settled = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

function mapRepository(r: any): GitHubRepository {
  return {
    id: r.id || r._id || '',
    projectId: r.projectId || r.project_id || '',
    // Backend returns repository_name / name — fall back through both.
    repoName: r.repoName || r.repositoryName || r.name || r.repository_name || '',
    defaultBranch: r.defaultBranch || r.default_branch || '',
    stars: r.stars ?? 0,
    openIssues: r.openIssues ?? r.open_issues ?? 0,
    lastSyncAt: r.lastSyncAt || r.last_sync_at || '',
  };
}

/**
 * Flatten the backend's per-repository pages (`repositories[].rows`). The top-level
 * `rows` is one 20-row page across all repositories, so a busy repository (e.g. the
 * backend) pushes every other repository's commits and PRs out of it.
 */
function rowsByRepository(data: any, dateKey: string): any[] {
  const d = fromApi(data);
  const groups: any[] = Array.isArray(d?.repositories) ? d.repositories : [];
  if (!groups.length) return rowsOf<any>(data);
  const seen = new Set<string>();
  return groups
    .flatMap((group) => (Array.isArray(group.rows) ? group.rows : [])
      // Stamp the repository's own id: stored rows may reference it by name.
      .map((row: any) => ({ ...row, repositoryId: group.repositoryId || row.repositoryId })))
    .filter((row) => {
      const key = String(row.id || row._id || '');
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b[dateKey] || 0).getTime() - new Date(a[dateKey] || 0).getTime());
}

function mapCommit(c: any): GitHubCommit {
  return {
    id: c.id || c._id,
    repositoryId: c.repositoryId || c.repoId || '',
    sha: c.sha ? (c.sha.length > 7 ? c.sha.substring(0, 7) : c.sha) : '',
    author: c.authorName || c.author || c.authorId || '',
    authorAvatar: c.authorAvatar || '',
    commitDate: c.commitDate || c.committedAt || '',
    message: c.message || '',
    filesChanged: c.filesChanged ?? 0,
    additions: c.additions ?? 0,
    deletions: c.deletions ?? 0,
  };
}

function mapPr(pr: any): GitHubPullRequest {
  return {
    id: pr.id || pr._id,
    repositoryId: pr.repositoryId || pr.repoId || '',
    number: pr.number ?? 0,
    title: pr.title || '',
    author: pr.author || pr.authorId || '',
    status: mapEnum(ENUM.prStatus.fromApi, pr.status || pr.state, 'OPEN') as any,
    createdAt: pr.createdAt || '',
    mergedAt: pr.mergedAt,
    reviewTimeHours: pr.reviewTimeHours ?? 0,
    commentsCount: pr.commentsCount ?? 0,
  };
}

/**
 * Repositories plus commit / PR / contributor feeds for a project. Commits and PRs
 * come from each repository's own page so every linked repository is represented.
 * Optional routes are tolerated.
 */
export async function getGitIntelligence(projectId: string) {
  return safeRead(
    async () => {
      const [reposRes, commitsRes, prsRes, contribRes] = await Promise.all([
        http.get(`/projects/${projectId}/repositories`),
        settled(http.get(`/projects/${projectId}/git/commits`), { data: [] } as any),
        settled(http.get(`/projects/${projectId}/git/pull-requests`), { data: [] } as any),
        settled(http.get(`/projects/${projectId}/git/contributors`), { data: [] } as any),
      ]);

      return {
        repositories: rowsOf<any>(reposRes.data).map(mapRepository),
        commits: rowsByRepository(commitsRes.data, 'committedAt').map(mapCommit),
        pullRequests: rowsByRepository(prsRes.data, 'createdAt').map(mapPr),
        contributors: rowsOf<GitHubContributor>(contribRes.data),
      };
    },
    { repositories: [], commits: [], pullRequests: [], contributors: [] },
    'git.intelligence'
  );
}

export async function getDoraMetrics(projectId: string) {
  return safeRead(async () => {
    const d = oneOf<any>((await http.get(`/projects/${projectId}/git/metrics`)).data);
    return d && typeof d.commits === 'number' ? d : null;
  }, null, 'git.metrics');
}

export async function getGitActivity(projectId: string) {
  return safeRead(async () => {
    const res = await http.get(`/projects/${projectId}/git/activity`);
    const d = fromApi(res.data);
    return Array.isArray(d?.activity) ? d.activity : rowsOf(res.data);
  }, [], 'git.activity');
}
