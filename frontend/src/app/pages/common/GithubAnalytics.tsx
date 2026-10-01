'use client';

import React, { useEffect, useState } from 'react';
import {
  GitCommit,
  GitPullRequest,
  GitFork,
  Code,
  Clock,
  User,
  Star,
  AlertCircle,
  ExternalLink,
  Plus,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { GitHubRepository, GitHubCommit, GitHubPullRequest, GitHubContributor } from '@shared/models';
import { Collapsible } from '@shared/components/Collapsible';

interface GithubAnalyticsProps {
  repositories: GitHubRepository[];
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  contributors: GitHubContributor[];
}

export const GithubAnalytics: React.FC<GithubAnalyticsProps> = ({
  repositories,
  commits,
  pullRequests,
  contributors,
}) => {
  const [selectedRepoId, setSelectedRepoId] = useState<string>(repositories[0]?.id || '');

  // The repo list arrives async (project switch); default the selector to the
  // first repo once it populates instead of staying stuck on '' (All).
  useEffect(() => {
    if (!selectedRepoId && repositories.length > 0) {
      setSelectedRepoId(repositories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  const filteredCommits = selectedRepoId
    ? commits.filter((c) => c.repositoryId === selectedRepoId)
    : commits;

  const filteredPrs = selectedRepoId
    ? pullRequests.filter((pr) => pr.repositoryId === selectedRepoId)
    : pullRequests;

  // Chart data for Code Churn additions vs deletions
  const churnData = filteredCommits.slice(0, 10).reverse().map((c) => ({
    sha: c.sha,
    additions: c.additions,
    deletions: c.deletions,
  }));

  return (
    <div className="space-y-6">
      {/* Top Bar: Repo Selector & Key GitHub Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border-2 border-slate-900 shadow-sm">
        <div>
          <h2 className="text-xl font-black italic tracking-tighter text-slate-900 flex items-center">
            <GitCommit className="w-5 h-5 text-indigo-600 mr-2" />
            GitHub Code &amp; PR Analytics
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-sans">
            Real-time commit telemetry, code churn, and PR review bottleneck inspection
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 p-2 border border-slate-300">
          <Code className="w-4 h-4 text-indigo-600 ml-1" />
          {/* The commit list can be filtered per repository (e.g., frontend vs backend) */}
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            className="bg-transparent text-xs text-slate-900 font-mono font-bold uppercase focus:outline-none cursor-pointer pr-2"
          >
            <option value="" className="bg-white">
              All Repositories
            </option>
            {repositories.map((r) => (
              <option key={r.id} value={r.id} className="bg-white">
                {r.repoName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Repositories Cards */}
      <Collapsible title="Repositories" defaultOpen bodyClassName="">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {repositories.map((repo) => (
          <div
            key={repo.id}
            onClick={() => setSelectedRepoId(repo.id)}
            className={`p-4 border cursor-pointer transition ${
              selectedRepoId === repo.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm tracking-tight truncate">{repo.repoName}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase border ${
                selectedRepoId === repo.id ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {repo.defaultBranch}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono mt-3">
              <span className="flex items-center">
                <Star className="w-3.5 h-3.5 mr-1 text-amber-500" />
                {repo.stars}
              </span>
              <span className="flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-500" />
                {repo.openIssues} Issues
              </span>
            </div>
          </div>
        ))}
      </div>
      </Collapsible>

      {/* Code Churn Graph */}
      <Collapsible title="Code churn — additions vs deletions">
        <p className="text-[10px] text-slate-500 font-mono mb-3">Lines added vs removed across recent commits</p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={churnData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="sha" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#cbd5e1',
                  borderRadius: '0px',
                  color: '#0f172a',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
              <Area type="monotone" dataKey="additions" name="Additions (+)" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              <Area type="monotone" dataKey="deletions" name="Deletions (-)" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Collapsible>

      {/* Grid: PR Review Latency Table & Recent Commits Feed */}
      <Collapsible
        title="Pull requests & commits"
        bodyClassName=""
        right={
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 px-2 py-1">
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              title="Filter pull requests & commits by repository"
              className="bg-transparent text-[10px] text-slate-800 font-mono font-bold uppercase focus:outline-none cursor-pointer pr-1"
            >
              <option value="" className="bg-white">
                All Repositories
              </option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id} className="bg-white">
                  {r.repoName}
                </option>
              ))}
            </select>
          </div>
        }
      >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pull Requests Status Table */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <GitPullRequest className="w-4 h-4 text-indigo-600 mr-2" />
            Pull Requests &amp; Review Latency
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">Tracking PR review bottlenecks</p>

          <div className="space-y-3">
            {filteredPrs.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
                No pull requests for this repository yet
              </p>
            ) : (
            filteredPrs.map((pr) => (
              <div
                key={pr.id}
                className="p-3.5 bg-slate-50 border border-slate-200 flex flex-col space-y-2"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold text-slate-900">{pr.title}</span>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                      pr.status === 'MERGED'
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {pr.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                  <span>Author: <strong className="text-slate-900">{pr.author}</strong></span>
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-slate-500" />
                    Review Latency: <strong className="text-indigo-700 ml-1">{pr.reviewTimeHours}h</strong>
                  </span>
                </div>
              </div>
            ))
            )}
          </div>
        </div>

        {/* Commits Stream */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <GitCommit className="w-4 h-4 text-emerald-600 mr-2" />
            Recent GitHub Commits Feed
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">Live telemetry feed from GitHub webhooks</p>

          <div className="space-y-3">
            {filteredCommits.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider py-6 text-center">
                No commits for this repository yet
              </p>
            ) : (
            filteredCommits.map((c) => (
              <div
                key={c.id}
                className="p-3.5 bg-slate-50 border border-slate-200 flex items-start justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] bg-slate-200 text-slate-900 px-1.5 py-0.5 font-bold">
                      {c.sha}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{c.author}</span>
                  </div>
                  <p className="text-xs text-slate-800 font-sans">{c.message}</p>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {new Date(c.commitDate).toLocaleString()}
                  </span>
                </div>
                <div className="text-right text-xs font-mono font-bold shrink-0">
                  <span className="text-emerald-700 block">+{c.additions}</span>
                  <span className="text-rose-700 block">-{c.deletions}</span>
                </div>
              </div>
            ))
            )}
          </div>
        </div>
      </div>
      </Collapsible>
    </div>
  );
};
