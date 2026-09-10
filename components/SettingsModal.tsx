'use client';

import React, { useState } from 'react';
import {
  X,
  Sliders,
  Cpu,
  CheckCircle2,
  Key,
  Globe,
  Layers,
  Sparkles,
  Bot,
} from 'lucide-react';
import { AIProviderName, AIProviderConfig } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: AIProviderConfig[];
  onSelectProvider: (provider: AIProviderName) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  providers,
  onSelectProvider,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Pluggable AI Provider &amp; System Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Providers Selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Select Active AI Provider Module
          </label>

          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.provider}
                onClick={() => onSelectProvider(p.provider)}
                className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  p.active
                    ? 'bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    <Bot className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-100">{p.provider}</span>
                      <span className="text-xs text-slate-400 font-mono">({p.modelName})</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {p.provider === 'GEMINI'
                        ? 'Google GenAI SDK (gemini-3.6-flash) - Default Production Engine'
                        : p.provider === 'OLLAMA'
                        ? 'Local Ollama endpoint execution'
                        : `External ${p.provider} LLM API integration`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {p.active ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Active Provider
                    </span>
                  ) : (
                    <button className="text-xs font-semibold text-slate-400 hover:text-slate-200">
                      Switch to {p.provider}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credentials & System Info */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Environment API Key:</span>
            <span className="font-mono text-emerald-400">GEMINI_API_KEY Configured</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">GitHub Organization:</span>
            <span className="font-mono text-slate-200">acme-software-labs</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Taiga Project Workspace:</span>
            <span className="font-mono text-slate-200">acme-taiga-workspace</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            Save &amp; Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
