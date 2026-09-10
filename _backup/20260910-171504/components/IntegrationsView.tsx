'use client';

import React, { useEffect, useState } from 'react';
import { Plug, Github, Loader2, X, Plus, Trello } from 'lucide-react';
import { IntegrationRow, SyncHistoryRow } from '@/types';
import {
  getProviderCatalog,
  listProjectIntegrations,
  connectProjectIntegration,
  disconnectIntegration,
  getIntegrationSyncHistory,
} from '@/lib/api';

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: 'Inactive', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  1: { label: 'Active', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  2: { label: 'Error', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};
const statusMeta = (s: number) => STATUS_META[s] ?? { label: `Status ${s}`, cls: 'bg-slate-100 text-slate-600 border-slate-300' };

export const IntegrationsView: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [providers, setProviders] = useState<{ id: string; name: string; type: string }[]>([]);
  const [rows, setRows] = useState<IntegrationRow[] | null>(null);
  const [wizardProvider, setWizardProvider] = useState<string | null>(null);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<SyncHistoryRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = () => listProjectIntegrations(projectId).then(setRows);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRows(null);
      const [cat, rowsData] = await Promise.all([getProviderCatalog(), listProjectIntegrations(projectId)]);
      if (!alive) return;
      setProviders(cat);
      setRows(rowsData);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const connect = async () => {
    if (!wizardProvider || !repoName.trim()) return;
    setBusy(true);
    try {
      await connectProjectIntegration(projectId, {
        provider: wizardProvider,
        repositoryName: repoName.trim(),
        repositoryUrl: repoUrl.trim() || undefined,
        token: token.trim() || undefined,
      });
      onToast(`${wizardProvider} linked to project`);
      setWizardProvider(null);
      setRepoName('');
      setRepoUrl('');
      setToken('');
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Could not link the integration');
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (id: string) => {
    setHistoryFor(id);
    setHistory(await getIntegrationSyncHistory(id));
  };

  const remove = async (id: string) => {
    try {
      await disconnectIntegration(projectId, id);
      onToast('Integration disconnected');
      if (historyFor === id) setHistoryFor(null);
      await reload();
    } catch (err: any) {
      onToast(err?.msg || 'Disconnect failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <Plug className="w-4 h-4" />
        <span>Integrations</span>
      </div>

      {/* Provider cards */}
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
            placeholder={wizardProvider === 'github' ? 'org/repository' : 'workspace/project'}
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="repository / board URL (optional)"
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="access token (optional)"
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
      <div className="bg-white border border-slate-300">
        <div className="px-4 py-2.5 border-b border-slate-300 text-[11px] font-black uppercase tracking-wider text-slate-800">
          Connected
        </div>
        {rows === null ? (
          <div className="p-6 flex items-center justify-center text-slate-500 text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
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
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${statusMeta(r.status).cls}`}>
                    {statusMeta(r.status).label}
                  </span>
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

              {historyFor === r.id && (
                <div className="mt-2 bg-slate-50 border border-slate-200">
                  {history.length === 0 && (
                    <div className="px-3 py-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      No sync history
                    </div>
                  )}
                  {history.map((h, i) => (
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
      </div>
    </div>
  );
};
