'use client';

import React, { useState } from 'react';
import { Repeat, Play, Terminal } from 'lucide-react';
import { SyncLog } from '@shared/models';

interface SyncEngineProps {
  logs: SyncLog[];
  onTriggerSync: (action?: string) => Promise<void>;
  isSyncing: boolean;
}

export const SyncEngine: React.FC<SyncEngineProps> = ({
  logs,
  onTriggerSync,
  isSyncing,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleAction = async (actionType?: string) => {
    setActiveAction(actionType || 'SYNC_15MIN');
    await onTriggerSync(actionType);
    setActiveAction(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Pipeline Controls */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Repeat className="w-4 h-4" />
            <span>node-cron Scheduler &amp; Webhook Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">15-Minute Data Sync Pipeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Collects raw GitHub commits/PRs and Taiga user stories/tasks every 15 minutes, calculates engineering metrics, and updates AI risk models.
          </p>
        </div>

        <button
          onClick={() => handleAction('SYNC_15MIN')}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/30 disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isSyncing && activeAction === 'SYNC_15MIN' ? 'animate-spin' : ''}`} />
          <span>Run 15-Min Pipeline Sync Now</span>
        </button>
      </div>

      {/* Execution Logs Terminal Feed */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100 flex items-center">
            <Terminal className="w-4 h-4 text-emerald-400 mr-2" />
            Live Sync Execution Logs
          </h3>
          <span className="text-xs text-slate-400 font-mono">Status: Active Scheduler</span>
        </div>

        <div className="space-y-3">
          {logs.length === 0 && (
            <p className="text-[11px] text-slate-500 font-mono py-4">
              No sync history returned by the backend.
            </p>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {log.status}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-200 text-xs font-sans">{log.message}</p>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center space-x-3 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 shrink-0">
                <span>Commits: <strong className="text-emerald-400">{log.recordsSynced.commits}</strong></span>
                <span>PRs: <strong className="text-purple-400">{log.recordsSynced.prs}</strong></span>
                <span>Stories: <strong className="text-cyan-400">{log.recordsSynced.stories}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
