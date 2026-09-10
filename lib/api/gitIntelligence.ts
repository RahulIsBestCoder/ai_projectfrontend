import { http } from './http';
import { fromApi } from './case';
import { ENUM, mapEnum } from './enums';
import { rowsOf, oneOf, safeRead } from './util';
import { GitHubRepository, GitHubCommit, GitHubPullRequest, GitHubContributor } from '@/types';

const settled = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

function mapCommit(c: any): GitHubCommit {
  return {
    id: c.id,
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
    id: pr.id,
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
 * The backend exposes project-scoped git *aggregates* (`/git/activity`,
 * `/git/metrics`) and a repository list, but no commit / PR / contributor list
 * route (project- or repo-scoped). We fetch what exists; commit/PR feeds stay
 * empty until such a route ships. Optional routes are probed and tolerated.
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
        repositories: rowsOf<GitHubRepository>(reposRes.data),
        commits: rowsOf<any>(commitsRes.data).map(mapCommit),
        pullRequests: rowsOf<any>(prsRes.data).map(mapPr),
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
