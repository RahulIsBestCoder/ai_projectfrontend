import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar, TabType } from '@/components/Sidebar';
import { OverviewDashboard } from '@/components/OverviewDashboard';
import { AiIntelligence } from '@/components/AiIntelligence';
import { DepartmentHealth } from '@/components/DepartmentHealth';
import { LoginView } from '@/components/LoginView';
import { PortfolioDashboard } from '@/components/PortfolioDashboard';
import { IntegrationsView } from '@/components/IntegrationsView';
import { ReportsView } from '@/components/ReportsView';
import { PlansView } from '@/components/PlansView';
import { Execution } from '@/components/project/Execution';
import { Health } from '@/components/project/Health';
import {
  Project,
  Organization,
  AIPrediction,
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubContributor,
  SyncLog,
  User,
  UserRole,
  AIProviderName,
} from '@/types';
import { CalculatedAnalytics } from '@/lib/analytics/calculator';

import {
  listProjects,
  listOrganizations,
  getAnalytics,
  getRiskPrediction,
  getGitIntelligence,
  getSyncLogs,
  runAIPrediction,
  triggerSync,
  getAccess,
  clearAuth,
} from '@/lib/api';

const ROLE_FROM_BACKEND: Record<string, UserRole> = {
  super_admin: 'ADMIN',
  org_admin: 'ADMIN',
  admin: 'ADMIN',
  project_manager: 'TECH_LEAD',
  member: 'DEVELOPER',
  viewer: 'DEVELOPER',
};

const EmptyState: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <div className="p-6 bg-white border-2 border-slate-900 shadow-sm">
    <h1 className="text-lg font-black text-slate-900">{title}</h1>
    <p className="text-xs text-slate-600 font-mono mt-1">{hint}</p>
  </div>
);

export function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!getAccess());
  const [activeTab, setActiveTab] = useState<TabType>('portfolio');

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [analytics, setAnalytics] = useState<CalculatedAnalytics | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);

  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);

  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [users] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({
    id: '',
    name: '',
    email: '',
    role: 'DEVELOPER',
    avatar: '',
    organizationId: '',
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Bounce to login when a request hits an unrecoverable 401
  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, []);

  // Org-level data
  const loadOrgData = async () => {
    const [orgs, projs] = await Promise.all([
      listOrganizations(),
      listProjects(),
    ]);
    setOrganization(orgs[0] ?? null);
    setProjects(projs);
    if (orgs[0]?.id) {
      setCurrentUser((c) => ({ ...c, organizationId: c.organizationId || orgs[0].id }));
    }
    setSelectedProjectId((cur) => cur || projs[0]?.id || '');
  };

  // Project-scoped data
  const loadProjectData = async (projectId: string) => {
     const [anal, pred, gitData, sync] = await Promise.all([
      getAnalytics(projectId),
      getRiskPrediction(projectId),
      getGitIntelligence(projectId),
      getSyncLogs(projectId),
    ]);
    setAnalytics(anal);
    setPrediction(pred);
    setRepositories(gitData.repositories);
    setCommits(gitData.commits);
    setPullRequests(gitData.pullRequests);
    setContributors(gitData.contributors);
    setSyncLogs(sync.logs);
  };

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    (async () => {
      try {
        await loadOrgData();
      } catch (err) {
        if (alive) console.error('Org data fetch error:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    (async () => {
      if (!selectedProjectId) {
        setAnalytics(null);
        setPrediction(null);
        setRepositories([]);
        setCommits([]);
        setPullRequests([]);
        setContributors([]);
        setSyncLogs([]);
        return;
      }
      try {
        await loadProjectData(selectedProjectId);
      } catch (err) {
        if (alive) console.error('Project data fetch error:', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authed, selectedProjectId]);

  const refreshData = async () => {
    await loadOrgData();
    if (selectedProjectId) await loadProjectData(selectedProjectId);
  };

  const handleTriggerSync = async (actionType?: string) => {
    setIsSyncing(true);
    try {
      await triggerSync(actionType, selectedProjectId);
      showToast('Sync pipeline triggered.');
      await refreshData();
    } catch (err: any) {
      showToast(err?.msg || 'Sync pipeline unavailable.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunPrediction = async (_customPrompt?: string, provider?: AIProviderName) => {
    if (!selectedProjectId) return;
    setIsPredicting(true);
    try {
      const activeP = provider || 'gemini';
      const newPred = await runAIPrediction(selectedProjectId, activeP);
      if (newPred) {
        setPrediction(newPred);
        showToast('AI prediction recalculated.');
        await refreshData();
      }
    } catch (err: any) {
      showToast(err?.msg || 'Prediction endpoint unavailable.');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSelectRole = (role: UserRole) => {
    const matchedUser = users.find((u) => u.role === role) || { ...currentUser, role };
    setCurrentUser(matchedUser);
    showToast(`Switched active role view to: ${role}`);
  };

  const handleSignOut = () => {
    clearAuth();
    setAuthed(false);
    setProjects([]);
    setSelectedProjectId('');
    setOrganization(null);
    showToast('Signed out');
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeProvider: AIProviderName = 'GEMINI';
  const orgId = currentUser.organizationId || organization?.id || '';
  const orgName = organization?.name || '';

  if (!authed) {
    return (
      <LoginView
        onSuccess={(u) => {
          setCurrentUser((c) => ({
            ...c,
            id: u.id || c.id,
            email: u.email || c.email,
            name: c.name || (u.email ? u.email.split('@')[0] : ''),
            role: (u.role && ROLE_FROM_BACKEND[u.role]) || c.role,
          }));
          setActiveTab('portfolio');
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-mono uppercase tracking-wider px-4 py-3 border-2 border-indigo-500 shadow-xl flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Navbar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => setSelectedProjectId(id)}
        currentUser={currentUser}
        onSelectRole={handleSelectRole}
        users={users}
        onTriggerSync={() => handleTriggerSync()}
        isSyncing={isSyncing}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 gap-6">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          delayRisk={prediction?.delayProbability ?? selectedProject?.delayProbability ?? 0}
          hasProject={!!selectedProjectId}
        />

        <main className="flex-1 min-w-0">
          {activeTab === 'portfolio' && (
            <PortfolioDashboard
              organizationName={orgName}
              organizationId={orgId}
              ownerId={currentUser.id}
              selectedProjectId={selectedProjectId}
              onOpenProject={(id) => {
                setSelectedProjectId(id);
                setActiveTab('overview');
              }}
              onProjectCreated={refreshData}
              onToast={showToast}
            />
          )}

          {activeTab === 'overview' &&
            (selectedProject && analytics ? (
              <OverviewDashboard
                project={selectedProject}
                analytics={analytics}
                prediction={prediction}
                onNavigateToAi={() => setActiveTab('ai')}
                onNavigateToSync={() => setActiveTab('execution')}
              />
            ) : (
              <EmptyState
                title={selectedProjectId ? 'No analytics for this project' : 'No project selected'}
                hint={
                  selectedProjectId
                    ? 'GET /projects/:id/analytics returned nothing. Pick another project or check the backend.'
                    : 'Open a project from Projects to see its workspace.'
                }
              />
            ))}

          {activeTab === 'plan' &&
            (selectedProjectId ? (
              <PlansView projectId={selectedProjectId} onToast={showToast} />
            ) : (
              <EmptyState title="No project selected" hint="Open a project from Projects." />
            ))}

          {activeTab === 'execution' &&
            (selectedProjectId ? (
              <Execution
                projectId={selectedProjectId}
                onToast={showToast}
                repositories={repositories}
                commits={commits}
                pullRequests={pullRequests}
                contributors={contributors}
              />
            ) : (
              <EmptyState title="No project selected" hint="Open a project from Projects." />
            ))}

          {activeTab === 'health' &&
            (selectedProjectId ? (
              <Health projectId={selectedProjectId} organizationId={orgId} onToast={showToast} />
            ) : (
              <EmptyState title="No project selected" hint="Open a project from Projects." />
            ))}

          {activeTab === 'departments' && <DepartmentHealth organizationId={orgId} />}

          {activeTab === 'ai' &&
            (selectedProjectId && analytics ? (
              <AiIntelligence
                projectId={selectedProjectId}
                prediction={prediction}
                analytics={analytics}
                onRunPrediction={handleRunPrediction}
                isPredicting={isPredicting}
                activeProvider={activeProvider}
              />
            ) : (
              <EmptyState
                title="AI assistant unavailable"
                hint="The analytics bundle for this project is required and was not returned by the backend."
              />
            ))}

          {activeTab === 'reports' &&
            (selectedProjectId ? (
              <ReportsView projectId={selectedProjectId} onToast={showToast} />
            ) : (
              <EmptyState title="No project selected" hint="Open a project from Projects." />
            ))}

          {activeTab === 'integrations' &&
            (selectedProjectId ? (
              <IntegrationsView projectId={selectedProjectId} onToast={showToast} />
            ) : (
              <EmptyState title="No project selected" hint="Open a project from Projects." />
            ))}
        </main>
      </div>
    </div>
  );
}

export default App;
