'use client';

import React, { useEffect, useState } from 'react';
import { ThemedLoader } from '@shared/components/ThemedLoader';
import { Plug, Github, Loader2, X, Plus, Trello, RefreshCw } from 'lucide-react';
import { Collapsible } from '@shared/components/Collapsible';
import { IntegrationRow, SyncHistoryRow } from '@shared/models';
import {
  getProviderCatalog,
  listProjectIntegrations,
  connectProjectIntegration,
  disconnectIntegration,
  updateIntegration,
  syncIntegration,
  summariseSync,
  SyncResult,
  getIntegrationSyncHistory,
  getRepoCategories,
  listIntegrationBranches,
  FALLBACK_REPO_CATEGORIES,
} from '@core/services';
import { RepoCategoryOption } from '@shared/models';

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: 'Inactive', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  1: { label: 'Active', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  2: { label: 'Error', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};
const statusMeta = (s: number) => STATUS_META[s] ?? { label: `Status ${s}`, cls: 'bg-slate-100 text-slate-600 border-slate-300' };

/** Compact per-row sync stats — stored repo `totals`, not this-run `items_synced`.
 *  Branch badge prefers the dataset's `sync_branch`; `no_changes` keeps totals visible. */
const SyncStats: React.FC<{ row: IntegrationRow; result: SyncResult }> = ({ row, result }) => {
  const totals = result.totals ?? result.itemsSynced;
  const isGitHub = row.provider?.toLowerCase() === 'github';
  const branch = result.syncBranch ?? result.sourceSync?.branch ?? row.branch;
  const noChanges = result.sourceSync?.mode === 'no_changes';
  const sha = result.sourceSync?.currentCommitSha || result.sourceSync?.previousCommitSha;
  const pill = 'px-1.5 py-0.5 text-[10px] font-mono font-bold border';
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {isGitHub && <span
        className={`${pill} bg-slate-50 text-slate-700 border-slate-200`}
        title="Stored repo totals — stable across re-syncs"
      >
        Commits: {totals?.commits != null ? totals.commits : '—'}
      </span>}
      {isGitHub && <span
        className={`${pill} bg-slate-50 text-slate-700 border-slate-200`}
        title="Repo total PRs (all branches); branch-scoped count from this run in parentheses"
      >
        PRs: {totals?.pullRequests != null ? totals.pullRequests : '—'}
        {result.itemsSynced?.pullRequestsForBranch != null && branch
          ? ` (${result.itemsSynced.pullRequestsForBranch} for ${branch})`
          : ''}
      </span>}
      {isGitHub && branch && (
        <span className={`${pill} bg-indigo-100 text-indigo-800 border-indigo-300`} title={`Syncing branch: ${branch}`}>
          ⎇ {branch}
        </span>
      )}
      {noChanges && sha && (
        <span
          className={`${pill} bg-emerald-100 text-emerald-800 border-emerald-300`}
          title="No new commits on this branch since the last sync — stored totals kept"
        >
          Up to date @ {sha.slice(0, 7)}
        </span>
      )}
    </div>
  );
};

export const IntegrationsView: React.FC<{
  projectId: string;
  projectName?: string;
  onToast: (m: string) => void;
}> = ({ projectId, projectName, onToast }) => {
  const [providers, setProviders] = useState<{ id: string; name: string; type: string }[]>([]);
  const [rows, setRows] = useState<IntegrationRow[] | null>(null);
  const [wizardProvider, setWizardProvider] = useState<string | null>(null);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyById, setHistoryById] = useState<Record<string, SyncHistoryRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editTokenValue, setEditTokenValue] = useState('');
  // GitHub "Edit details" — rename repo, change URL, re-tag category, swap token.
  const [editingDetails, setEditingDetails] = useState<string | null>(null);
  const [editRepoName, setEditRepoName] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [editDetailsCategory, setEditDetailsCategory] = useState('other');
  const [editBranch, setEditBranch] = useState('');
  const [branchOptions, setBranchOptions] = useState<Record<string, { name: string; protected: boolean }[]>>({});
  const [branchesLoading, setBranchesLoading] = useState<string | null>(null);
  const [branchesError, setBranchesError] = useState<Record<string, string>>({});
  // Last sync result per integration — renders stored repo `totals` (not this-run counts).
  const [lastSyncById, setLastSyncById] = useState<Record<string, SyncResult>>({});

  /** Load live branch options for a linked GitHub repo (badge + datalist suggestions). */
  const loadBranches = async (id: string, tokenOverride?: string) => {
    setBranchesLoading(id);
    try {
      const r = await listIntegrationBranches({ integrationId: id, token: tokenOverride?.trim() || undefined });
      setBranchOptions((prev) => ({ ...prev, [id]: r.branches }));
      setBranchesError((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      setBranchesError((prev) => ({ ...prev, [id]: err?.msg || 'Could not load branches' }));
    } finally {
      setBranchesLoading(null);
    }
  };
  // Taiga auth credentials — sent to the backend on create; used to obtain a token on first sync.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [editingCreds, setEditingCreds] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  // "What is this repo for" dropdown — categories fetched from the backend,
  // with a local fallback so the picker always renders.
  const [categories, setCategories] = useState<RepoCategoryOption[]>(FALLBACK_REPO_CATEGORIES);
  const [category, setCategory] = useState('other');
  // Git branch to sync (GitHub wizard) — free text, defaults to the repo default branch.
  const [branch, setBranch] = useState('');
  const catMeta = (v?: string) => categories.find((c) => c.value === (v || 'other')) || categories[categories.length - 1];

  const reload = () => listProjectIntegrations(projectId).then(setRows);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRows(null);
      const [cat, rowsData, cats] = await Promise.all([
        getProviderCatalog(),
        listProjectIntegrations(projectId),
        getRepoCategories(),
      ]);
      if (!alive) return;
      setProviders(cat);
      setRows(rowsData);
      setCategories(cats);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const connect = async () => {
    if (!wizardProvider || !repoName.trim()) return;
    if (wizardProvider === 'taiga' && (!username.trim() || !password)) {
      onToast('Taiga requires an account username and password to authenticate on sync');
      return;
    }
    setBusy(true);
    try {
      await connectProjectIntegration(projectId, {
        provider: wizardProvider,
        repositoryName: repoName.trim(),
        repositoryUrl: repoUrl.trim() || undefined,
        username: wizardProvider === 'taiga' ? username.trim() || undefined : undefined,
        password: wizardProvider === 'taiga' ? password || undefined : undefined,
        token: token.trim() || undefined,
        branch: wizardProvider === 'github' ? branch.trim() || undefined : undefined,
        category: wizardProvider === 'github' ? category : undefined,
      });
      onToast(
        wizardProvider === 'github'
          ? `${wizardProvider} linked to project · ${catMeta(category).label}`
          : `${wizardProvider} linked to project`,
      );
      setWizardProvider(null);
      setRepoName('');
      setCategory('other');
      setBranch('');
      setRepoUrl('');
      setUsername('');
      setPassword('');
      setToken('');
      await reload();
    } catch (err: any) {
      const savedId = err?.dataset?.integrationId;
      onToast(savedId ? `${err?.msg || 'Initial sync failed'} — connection saved; use Retry to sync it.` : err?.msg || 'Could not link the integration');
      await reload();
    } finally {
      // Never persist a provider credential in component state after submission.
      setToken('');
      setBusy(false);
    }
  };

  const openHistory = async (id: string) => {
    setHistoryFor(id);
    const nextHistory = await getIntegrationSyncHistory(id);
    setHistoryById((prev) => ({ ...prev, [id]: nextHistory }));
  };

  const doSync = async (id: string) => {
    setSyncingId(id);
    try {
      const r = await syncIntegration(id);
      setLastSyncById((prev) => ({ ...prev, [id]: r }));
      onToast(summariseSync(r.itemsSynced));
      await reload();
      if (historyFor === id) await openHistory(id);
    } catch (err: any) {
      onToast(err?.msg || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await disconnectIntegration(projectId, id);
      onToast('Integration disconnected');
      if (historyFor === id) setHistoryFor(null);
      setHistoryById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Disconnect failed');
    }
  };

  const startEditToken = (id: string) => {
    setEditingToken(id);
    setEditTokenValue('');
  };

  const cancelEditToken = () => {
    setEditingToken(null);
    setEditTokenValue('');
  };

  const saveToken = async (id: string) => {
    if (!editTokenValue.trim()) {
      onToast('Token cannot be empty');
      return;
    }
    setBusy(true);
    try {
      await updateIntegration(id, { token: editTokenValue.trim() });
      onToast('Token updated successfully');
      cancelEditToken();
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Could not update token');
    } finally {
      setBusy(false);
    }
  };

  // --- GitHub details editing (PUT /v1/integrations/:id — name/url/category/token) ----

  const startEditDetails = (r: IntegrationRow) => {
    setEditingDetails(r.id);
    setEditRepoName(r.repositoryName || '');
    setEditRepoUrl(r.repositoryUrl || '');
    setEditDetailsCategory(catMeta(r.category).value);
    setEditBranch(r.branch || '');
    setEditTokenValue('');
    // Fetch live branch options so the user can pick instead of guessing.
    if (r.provider === 'github') void loadBranches(r.id);
  };

  const cancelEditDetails = () => {
    setEditingDetails(null);
    setEditRepoName('');
    setEditRepoUrl('');
    setEditBranch('');
    setEditTokenValue('');
  };

  const saveDetails = async (id: string) => {
    if (!editRepoName.trim()) {
      onToast('Repository name is required');
      return;
    }
    setBusy(true);
    try {
      // Blank URL/token are sent as undefined (omitted from the JSON body) so the
      // backend keeps the stored values instead of wiping them. An empty
      // branch string also means "keep stored"; use "(default)" hint in UI.
      const branchTrimmed = editBranch.trim();
      await updateIntegration(id, {
        repositoryName: editRepoName.trim(),
        repositoryUrl: editRepoUrl.trim() || undefined,
        category: editDetailsCategory,
        ...(branchTrimmed ? { branch: branchTrimmed } : {}),
        token: editTokenValue.trim() || undefined,
      } as Partial<IntegrationRow>);
      onToast('GitHub details updated');
      cancelEditDetails();
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Could not update details');
    } finally {
      setBusy(false);
    }
  };

  // --- Category re-tagging (PUT /v1/integrations/:id — category) ----

  const changeCategory = async (id: string, next: string) => {
    setBusy(true);
    try {
      await updateIntegration(id, { category: next } as Partial<IntegrationRow>);
      onToast(`Repo tagged as ${catMeta(next).label}`);
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Could not update category');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  // --- Taiga credentials editing (PUT /v1/integrations/:id — username/password) ----

  const startEditCreds = (r: IntegrationRow) => {
    setEditingCreds(r.id);
    // Pre-fill the saved username — it is not a secret and the API returns it.
    // The password is never echoed; `hasPassword` tells the user one is stored
    // and leaving the field blank keeps it.
    setEditUsername(r.username || '');
    setEditPassword('');
  };

  const cancelEditCreds = () => {
    setEditingCreds(null);
    setEditUsername('');
    setEditPassword('');
  };

  const saveCreds = async (r: IntegrationRow) => {
    const nextUsername = editUsername.trim();
    if (!nextUsername) {
      onToast('Taiga username is required');
      return;
    }
    if (!editPassword && !r.hasPassword && !r.password) {
      onToast('Taiga password is required — no stored password to keep');
      return;
    }
    setBusy(true);
    try {
      await updateIntegration(r.id, {
        username: nextUsername,
        // A blank password means "keep the stored one" — omit it from the body.
        ...(editPassword ? { password: editPassword } : {}),
      } as Partial<IntegrationRow>);
      onToast('Taiga credentials updated — the next sync will re-authenticate');
      cancelEditCreds();
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Could not update credentials');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center justify-between text-indigo-700 text-xs font-black uppercase tracking-widest">
        <div className="flex items-center space-x-2">
          <Plug className="w-4 h-4" />
          <span>Integrations</span>
        </div>
        <span className="font-mono text-slate-500 normal-case tracking-normal">
          {projectName || 'project'}
          {rows ? ` · ${rows.length} connected` : ''}
        </span>
      </div>

      {/* Instruction manual — what data to provide per provider */}
      <div className="p-5 bg-indigo-50 border border-indigo-200 space-y-3">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900">
            Data requirements — what to provide for each integration
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* GitHub card */}
          <div className="bg-white border border-indigo-200 p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Github className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-bold text-slate-900">GitHub</span>
              <span className="text-[10px] font-mono uppercase text-indigo-600 bg-indigo-100 px-1.5 py-0.5">VCS</span>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
              <li>
                <span className="font-semibold text-slate-800">Repository name</span> — required. Format: <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">owner/repo</code> (e.g., <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">acme/webapp</code>).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Repository URL</span> — optional. The full HTTPS or SSH URL to the repo (e.g., <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">https://github.com/acme/webapp</code>).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Token</span> — not needed for public repos. For private repos, a GitHub personal access token with <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">repo</code> scope.
              </li>
              <li className="text-slate-500 italic">Sync pulls: commits (with line stats) &amp; pull requests.</li>
            </ul>
          </div>
          {/* Taiga card */}
          <div className="bg-white border border-indigo-200 p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <Trello className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-bold text-slate-900">Taiga</span>
              <span className="text-[10px] font-mono uppercase text-indigo-600 bg-indigo-100 px-1.5 py-0.5">Work</span>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside">
              <li>
                <span className="font-semibold text-slate-800">Board slug</span> — <span className="text-rose-600 font-bold">required</span>. The project slug from your Taiga URL (e.g., <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">my-project</code> from <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">taiga.io/project/my-project</code>). This links your Taiga board to the project.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Board URL</span> — optional. The full Taiga project page (e.g., <code className="bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">https://tree.taiga.io/project/my-project</code>). When present, the backend derives the slug from it.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Account username</span> — <span className="text-rose-600 font-bold">required</span>. Your Taiga login username/email. Stored on the integration document and used to authenticate on sync.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Account password</span> — <span className="text-rose-600 font-bold">required</span>. Your Taiga login password. Stored on the integration document; used only for authentication.
              </li>
              <li>
                <span className="font-semibold text-slate-800">API token</span> — optional. On the first sync the backend authenticates with your username/password, stores the returned token, and uses it afterwards. A token supplied here is used directly.
              </li>
              <li className="text-slate-500 italic">Sync pulls: user stories / work items (with story points) &amp; sprints.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Provider cards */}
      <Collapsible title="Available providers" defaultOpen bodyClassName="">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div key={p.id} className="p-5 bg-white border border-slate-300 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-slate-100 border border-slate-300 flex items-center justify-center">
                {p.id === 'github' ? <Github className="w-5 h-5" /> : <Trello className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{p.name}</div>
                <div className="text-[10px] font-mono uppercase text-slate-400">{p.type}</div>
              </div>
            </div>
            <button
              onClick={() => setWizardProvider(p.id)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          </div>
        ))}
      </div>
      </Collapsible>

      {/* Wizard */}
      {wizardProvider && (
        <div className="p-5 bg-white border-2 border-indigo-600 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
              Connect {wizardProvider}
            </h3>
            <button onClick={() => setWizardProvider(null)}>
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder={wizardProvider === 'github' ? 'org/repository' : 'Taiga board slug (e.g. my-project)'}
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder={wizardProvider === 'github' ? 'repository URL (https://github.com/org/repo)' : 'Taiga board page URL (https://tree.taiga.io/project/slug)'}
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
          />
          {wizardProvider === 'taiga' && (
            <>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Taiga account username (required for sync auth)"
                autoComplete="off"
                className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Taiga account password (required for sync auth)"
                autoComplete="new-password"
                className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
              />
            </>
          )}
          {/* Team/purpose dropdown — "this repo is for ..." (GitHub repos only) */}
          {wizardProvider === 'github' && (
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                This repo is for
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-[10px] font-mono text-slate-400">
                {catMeta(category).description || catMeta(category).label}
              </span>
            </label>
          )}
          {/* Branch picker (GitHub only) — blank = repo default branch. */}
          {wizardProvider === 'github' && (
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                Branch to sync (optional)
              </span>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. main — blank uses the repo default"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
              />
              <span className="block mt-1 text-[10px] font-mono text-slate-400">
                Files + commit history follow the selected branch. PR storage covers all branches; the row shows a branch-scoped count.
              </span>
            </label>
          )}
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={wizardProvider === 'taiga' ? 'API token (optional — auto-obtained from username/password on first sync)' : 'access token (optional)'}
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <button
            onClick={connect}
            disabled={busy || !repoName.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50 flex items-center space-x-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Link to project</span>
          </button>
        </div>
      )}

      {/* Connected list */}
      <Collapsible
        title="Connected"
        subtitle={rows ? `${rows.length} linked` : undefined}
        bodyClassName=""
      >
        {rows === null ? (
          <div className="p-6 flex items-center justify-center text-slate-500 text-xs font-mono">
            <ThemedLoader label="Loading integrations" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-[11px] font-mono uppercase tracking-wider text-slate-400">
            No integrations connected
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 min-w-0">
                  {r.provider === 'github' ? (
                    <Github className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <Trello className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span className="text-xs font-mono text-slate-800 truncate">{r.repositoryName}</span>
                  {r.provider === 'github' && r.branch && (
                    <span
                      title={`Syncing branch: ${r.branch}`}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 truncate max-w-[140px]"
                    >
                      ⎇ {r.branch}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {/* Category chip + inline re-tag — "what is this repo for" (GitHub only) */}
                  {r.provider === 'github' && (
                    <>
                      <span
                        className="w-2.5 h-2.5 shrink-0"
                        style={{ backgroundColor: catMeta(r.category).color }}
                        title={catMeta(r.category).description || catMeta(r.category).label}
                      />
                      <select
                        value={catMeta(r.category).value}
                        disabled={busy || syncingId === r.id}
                        onChange={(e) => changeCategory(r.id, e.target.value)}
                        title="What is this repo for?"
                        className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 focus:outline-none disabled:opacity-50 cursor-pointer"
                      >
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${statusMeta(r.status).cls}`}>
                    {statusMeta(r.status).label}
                  </span>
                  {r.provider === 'taiga' && !r.hasToken && !(r.hasUsername || r.username) && !(r.hasPassword || r.password) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border bg-amber-100 text-amber-800 border-amber-300">
                      Auth required
                    </span>
                  )}
                  <button
                    onClick={() => doSync(r.id)}
                    disabled={syncingId === r.id}
                    title={r.provider === 'github' ? 'Pull commits & PRs from GitHub' : 'Sync work items & sprints from Taiga'}
                    className="flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 disabled:opacity-50"
                  >
                    {syncingId === r.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                    ) : (
                      <RefreshCw className="w-3 h-3 text-indigo-600" />
                    )}
                    <span>{syncingId === r.id ? 'Syncing' : 'Sync now'}</span>
                  </button>
                  {r.provider === 'github' ? (
                    <button
                      onClick={() => startEditDetails(r)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                      title="Edit repository name, URL, category or token"
                    >
                      Edit Details
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditToken(r.id)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                      title="Edit API token"
                    >
                      Edit Token
                    </button>
                  )}
                  {r.provider === 'taiga' && (
                    <button
                      onClick={() => startEditCreds(r)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                      title="Edit Taiga account credentials"
                    >
                      Edit Auth
                    </button>
                  )}
                  <button
                    onClick={() => (historyFor === r.id ? setHistoryFor(null) : openHistory(r.id))}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                  >
                    History
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="px-2 py-1 bg-white hover:bg-rose-50 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-rose-600"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {lastSyncById[r.id] && <SyncStats row={r} result={lastSyncById[r.id]} />}

              {/* Token editing UI */}
              {editingToken === r.id && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800">
                      API Token {r.provider === 'taiga' && '(Required for Taiga sync)'}
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="password"
                      value={editTokenValue}
                      onChange={(e) => setEditTokenValue(e.target.value)}
                      placeholder="Enter your API token..."
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-white border border-amber-300 focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <button
                      onClick={() => saveToken(r.id)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      {busy ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEditToken}
                      disabled={busy}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {r.provider === 'taiga' && (
                    <p className="mt-2 text-[10px] font-mono text-amber-700">
                      Taiga requires auth even for public boards. A token here is used directly; otherwise the backend obtains one from the saved username/password on the first sync.
                    </p>
                  )}
                </div>
              )}

              {/* GitHub details editing UI — name, URL, category, token */}
              {editingDetails === r.id && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-300 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800">
                      GitHub repository details
                    </label>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editRepoName}
                      onChange={(e) => setEditRepoName(e.target.value)}
                      placeholder="org/repository (required)"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={editRepoUrl}
                      onChange={(e) => setEditRepoUrl(e.target.value)}
                      placeholder="repository URL (https://github.com/org/repo) — leave blank to keep current"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <label className="block">
                      <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800 mb-1">
                        This repo is for
                      </span>
                      <select
                        value={editDetailsCategory}
                        onChange={(e) => setEditDetailsCategory(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                      >
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <span className="block mt-1 text-[10px] font-mono text-indigo-400">
                        {catMeta(editDetailsCategory).description || catMeta(editDetailsCategory).label}
                      </span>
                    </label>
                    <label className="block">
                      <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800 mb-1">
                        Branch to sync
                      </span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value)}
                          placeholder={r.branch ? r.branch : 'repo default — type to switch, e.g. develop'}
                          autoComplete="off"
                          spellCheck={false}
                          list={`branches-${r.id}`}
                          className="flex-1 px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => loadBranches(r.id, editTokenValue)}
                          disabled={branchesLoading === r.id}
                          title="Load branch list from GitHub"
                          className="px-2 py-1.5 bg-white hover:bg-slate-100 border border-indigo-300 text-[10px] font-bold uppercase tracking-wider text-indigo-700 disabled:opacity-50 shrink-0"
                        >
                          {branchesLoading === r.id ? '…' : '↻'}
                        </button>
                      </div>
                      <datalist id={`branches-${r.id}`}>
                        {(branchOptions[r.id] || []).map((b) => (
                          <option key={b.name} value={b.name} />
                        ))}
                      </datalist>
                      {branchesError[r.id] ? (
                        <span className="block mt-1 text-[10px] font-mono text-rose-600">{branchesError[r.id]}</span>
                      ) : (branchOptions[r.id] || []).length > 0 ? (
                        <span className="block mt-1 text-[10px] font-mono text-indigo-400">
                          {(branchOptions[r.id] || []).length} branches · current: {r.branch || 'default'}
                        </span>
                      ) : (
                        <span className="block mt-1 text-[10px] font-mono text-indigo-400">
                          Blank keeps “{r.branch || 'repo default'}”. Press ↻ to pick from live branches.
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={editTokenValue}
                      onChange={(e) => setEditTokenValue(e.target.value)}
                      placeholder="access token"
                      autoComplete="new-password"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    {r.hasToken && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="password"
                          value={'••••••••'}
                          readOnly
                          className="flex-1 px-2 py-1.5 text-[10px] font-mono bg-indigo-100 border border-indigo-200 text-slate-600"
                        />
                        <span className="text-[10px] text-slate-500">stored token — never returned by the API; enter a new one above to replace</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      onClick={() => saveDetails(r.id)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      {busy ? 'Saving...' : 'Save details'}
                    </button>
                    <button
                      onClick={cancelEditDetails}
                      disabled={busy}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-mono text-indigo-700">
                    A new token replaces the stored one and is used by the next sync.
                  </p>
                </div>
              )}

              {editingCreds === r.id && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-300 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800">
                      Taiga account credentials
                    </label>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder={r.hasUsername || r.username ? 'Saved username' : 'Taiga username'}
                      autoComplete="off"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={r.hasPassword || r.password
                        ? 'Stored password — leave blank to keep'
                        : 'Taiga password'}
                      autoComplete="new-password"
                      className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-indigo-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  {(r.hasPassword || r.password) ? (
                    <p className="mt-1 text-[10px] font-mono text-indigo-600">
                      A Taiga password is stored. Leave the password field blank to keep it; typing a new one replaces it.
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] font-mono text-amber-700">
                      No Taiga password is stored — enter one to make this integration sync-able.
                    </p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      onClick={() => saveCreds(r)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                    >
                      {busy ? 'Saving...' : 'Save credentials'}
                    </button>
                    <button
                      onClick={cancelEditCreds}
                      disabled={busy}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-mono text-indigo-700">
                    On the next sync the backend authenticates with these credentials and caches a Taiga API token.
                  </p>
                </div>
              )}

              {historyFor === r.id && (
                <div className="mt-2 bg-slate-50 border border-slate-200">
                  {(historyById[r.id] ?? []).length === 0 && (
                    <div className="px-3 py-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      No sync history
                    </div>
                  )}
                  {(historyById[r.id] ?? []).map((h, i) => (
                    <div
                      key={h.id || i}
                      className={`px-3 py-1.5 text-[10px] font-mono flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 ${
                        h.status === 'failed' || h.status === 'error' || h.status === 'partial'
                          ? 'text-rose-700 bg-rose-50'
                          : 'text-slate-600'
                      }`}
                    >
                      <span>{new Date(h.createdAt).toLocaleString()}</span>
                      <span className="uppercase font-bold">{h.status}</span>
                      <span className="truncate max-w-[50%] text-right">
                        {h.errorMessage || `${h.itemsSynced ?? 0} items`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Collapsible>
    </div>
  );
};
