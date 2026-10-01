'use client';

import React from 'react';
import {
  RefreshCw,
  UserCheck,
  Layers,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Project, UserRole, User } from '@shared/models';

export interface AiSyncStatus {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

interface NavbarProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  currentUser: User;
  onSelectRole: (role: UserRole) => void;
  users: User[];
  onTriggerSync: () => void;
  isSyncing: boolean;
  onAiSync: () => void;
  isAiSyncing: boolean;
  aiSyncStatus: AiSyncStatus | null;
  onSignOut?: () => void;
}

const AI_SYNC_TONE: Record<AiSyncStatus['tone'], string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  error: 'text-rose-700',
};

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  currentUser,
  onSelectRole,
  users,
  onTriggerSync,
  isSyncing,
  onAiSync,
  isAiSyncing,
  aiSyncStatus,
  onSignOut,
}) => {
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-300 px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
        {/* Left: Brand & App Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center text-white font-black text-xs tracking-wider shrink-0">
            PI
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <h1 className="text-xs sm:text-sm font-black tracking-widest uppercase text-slate-900 truncate">
                AI Project Intelligence Platform
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                v2.4.0 Backend
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-tight hidden sm:block">
              GitHub &amp; Taiga Analytics • AI Delivery Risk Engine
            </p>
          </div>
        </div>

        {/* Mobile: selector + AI sync + actions wrap into rows; md+: each becomes a direct flex child again */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full md:contents">
        {/* Center: Project Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 border border-slate-300 min-w-0 flex-1 md:flex-none">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <select
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="w-full md:w-auto min-w-0 bg-transparent text-xs text-slate-900 font-mono font-bold uppercase focus:outline-none cursor-pointer pr-2 truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-white text-slate-900">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* AI Sync: one control for every tab, scoped to the selected project */}
        {selectedProjectId && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAiSync}
              disabled={isAiSyncing}
              aria-busy={isAiSyncing}
              aria-label={`AI Sync ${selectedProject?.name ?? 'selected project'}`}
              title="Pull fresh GitHub data so every tab uses current evidence"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[11px] font-black uppercase tracking-widest border border-violet-700 disabled:opacity-60"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiSyncing ? 'animate-spin' : ''}`} />
              <span>{isAiSyncing ? 'Syncing AI context...' : 'AI Sync'}</span>
            </button>
            <span
              role="status"
              aria-live="polite"
              className={`hidden lg:inline max-w-48 truncate text-[10px] font-mono ${aiSyncStatus ? AI_SYNC_TONE[aiSyncStatus.tone] : ''}`}
              title={aiSyncStatus?.text}
            >
              {aiSyncStatus?.text}
            </span>
          </div>
        )}

        {/* Right: Actions, Sync, RBAC Switcher, Settings */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Sync Button */}
          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold uppercase tracking-wider border border-slate-300 transition disabled:opacity-50"
            title="Trigger 15-Minute GitHub & Taiga Sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">15-Min Sync</span>
          </button>

          {/* RBAC Role Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 border border-slate-300 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={currentUser.role}
              onChange={(e) => onSelectRole(e.target.value as UserRole)}
              className="bg-transparent text-slate-900 font-mono text-[11px] font-bold uppercase focus:outline-none cursor-pointer"
            >
              <option value="ADMIN" className="bg-white text-slate-900">
                Admin
              </option>
              <option value="TECH_LEAD" className="bg-white text-slate-900">
                Tech Lead
              </option>
              <option value="ENG_MANAGER" className="bg-white text-slate-900">
                Eng Manager
              </option>
              <option value="DEVELOPER" className="bg-white text-slate-900">
                Developer
              </option>
            </select>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
