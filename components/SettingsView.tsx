import React from 'react';
import {
  Sliders,
  Bot,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Database,
  Cpu,
} from 'lucide-react';
import { AIProviderName, AIProviderConfig, User } from '@/types';
import { API_BASE_URL } from '@/lib/api/env';

interface SettingsViewProps {
  providers: AIProviderConfig[];
  onSelectProvider: (provider: AIProviderName) => void;
  currentUser: User;
  organizationName?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  providers,
  onSelectProvider,
  currentUser,
  organizationName,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
            <Sliders className="w-4 h-4" />
            <span>Platform Configuration &amp; AI Providers</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            System Settings
          </h1>
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            Configure pluggable AI models, review backend feature flags, and manage connected workspace integrations.
          </p>
        </div>
      </div>

      {/* AI Providers Grid */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pluggable AI Delivery Intelligence Providers
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Active: <strong className="text-indigo-700">{providers.find((p) => p.active)?.provider || 'none'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const isActive = p.active;
            return (
              <div
                key={p.provider}
                onClick={() => onSelectProvider(p.provider)}
                className={`p-4 border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                  isActive
                    ? 'bg-indigo-50/50 border-indigo-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 border flex items-center justify-center font-bold text-xs ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{p.provider}</span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 border border-slate-200">
                          {p.modelName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        {p.provider === 'GEMINI'
                          ? 'Google GenAI SDK — Default Production Engine'
                          : p.provider === 'OLLAMA'
                          ? 'Local / Self-hosted Ollama endpoint'
                          : `External ${p.provider} LLM API integration`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500 font-mono text-[10px]">
                    Key Status: <strong className="text-slate-800">{p.apiKeySet ? 'Configured' : 'Auto-configured'}</strong>
                  </span>
                  {isActive ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-mono uppercase bg-indigo-100 text-indigo-800 border border-indigo-300">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-indigo-600" />
                      Active Provider
                    </span>
                  ) : (
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">
                      Switch to {p.provider}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data source & API Transport */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white border-2 border-slate-900 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
            <Database className="w-4 h-4" />
            <span>Data Source</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200">
              <span className="text-slate-700 font-bold">Mode</span>
              <span className="px-2 py-0.5 font-bold uppercase text-[10px] border bg-emerald-100 text-emerald-800 border-emerald-300">
                Backend only
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200">
              <span className="text-slate-700 font-bold">Demo / mock data</span>
              <span className="px-2 py-0.5 font-bold uppercase text-[10px] border bg-slate-200 text-slate-700 border-slate-300">
                Disabled
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200">
              <span className="text-slate-700 font-bold">Empty response</span>
              <span className="px-2 py-0.5 font-bold uppercase text-[10px] border bg-slate-100 text-slate-600 border-slate-200">
                Shows empty state
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
              Every screen renders only what the backend returns. If a route is unavailable the screen
              shows an empty or error state instead of sample data.
            </p>
          </div>
        </div>

        {/* System & Workspace Info */}
        <div className="p-6 bg-white border-2 border-slate-900 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
            <Globe className="w-4 h-4" />
            <span>Workspace &amp; Transport Info</span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block">Backend API Base URL</span>
              <span className="font-bold text-indigo-700 text-xs break-all">{API_BASE_URL}</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block">Connected Organization</span>
              <span className="font-bold text-slate-900 text-xs">
                {organizationName || currentUser.organizationId || '—'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase block">Current Authenticated User</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900 text-xs">
                  {currentUser.name} ({currentUser.email})
                </span>
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-800 border border-purple-300 font-bold uppercase">
                  {currentUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
