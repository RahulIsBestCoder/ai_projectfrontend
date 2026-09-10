'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { WorkItemsBoard } from '@/components/WorkItemsBoard';
import { SprintIntelligence } from '@/components/SprintIntelligence';
import { GithubAnalytics } from '@/components/GithubAnalytics';
import {
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContributor,
} from '@/types';

interface ExecutionProps {
  projectId: string;
  onToast: (m: string) => void;
  repositories: GitHubRepository[];
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  contributors: GitHubContributor[];
}

/**
 * Execution — what is actually happening in the project.
 * Merges the former Work Items, Sprint Intelligence and GitHub Engineering
 * tabs into a single scrollable section (Simplified Frontend Plan §9).
 */
export const Execution: React.FC<ExecutionProps> = ({
  projectId,
  onToast,
  repositories,
  commits,
  pullRequests,
  contributors,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <Activity className="w-4 h-4" />
        <span>Execution</span>
      </div>

      <Section title="Current sprint">
        <SprintIntelligence projectId={projectId} />
      </Section>

      <Section title="Work items">
        <WorkItemsBoard projectId={projectId} onToast={onToast} />
      </Section>

      <Section title="GitHub activity">
        <GithubAnalytics
          repositories={repositories}
          commits={commits}
          pullRequests={pullRequests}
          contributors={contributors}
        />
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
      {title}
    </h2>
    {children}
  </section>
);
