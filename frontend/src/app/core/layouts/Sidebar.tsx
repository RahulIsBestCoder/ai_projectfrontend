'use client';

import React from 'react';
import {
  BarChart3,
  Brain,
  Users,
  Sparkles,
  LayoutGrid,
  GaugeCircle,
  Activity,
  Plug,
  FileText,
  Sliders,
} from 'lucide-react';

/**
 * Simplified navigation (Simplified Frontend Plan §3).
 *
 * Top level:  Projects · Reports · Integrations
 * In project: Overview · Plan · Execution · Health · Departments · AI Assistant
 *
 * The former per-concept tabs (workitems / sprints / github / analytics / risks /
 * plans / sync / admin) are kept in the union for backward compatibility but are
 * no longer surfaced in the nav — they are composed into the sections above.
 */
export type TabType =
  | 'portfolio'
  | 'overview'
  | 'plan'
  | 'execution'
  | 'health'
  | 'departments'
  | 'ai'
  | 'reports'
  | 'integrations'
  | 'settings'
  // legacy / non-navigable
  | 'workitems'
  | 'sprints'
  | 'github'
  | 'analytics'
  | 'risks'
  | 'plans'
  | 'sync'
  | 'admin';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  delayRisk: number;
  hasProject?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
  badge?: string | null;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  delayRisk,
  hasProject = true,
}) => {
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'AI Project Intelligence',
      items: [
        { id: 'portfolio', label: 'Projects', icon: LayoutGrid },
        { id: 'integrations', label: 'Integrations', icon: Plug },
      ],
    },
    ...(hasProject
      ? [
          {
            title: 'Project',
            items: [
              { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
              { id: 'plan' as TabType, label: 'Plan', icon: Sparkles },
              { id: 'execution' as TabType, label: 'Execution', icon: Activity },
              {
                id: 'health' as TabType,
                label: 'Health',
                icon: GaugeCircle,
                badge: delayRisk > 50 ? `${delayRisk}%` : null,
                badgeColor:
                  delayRisk > 70
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300',
              },
              { id: 'departments' as TabType, label: 'Departments', icon: Users },
              { id: 'ai' as TabType, label: 'AI Assistant', icon: Brain },
            ],
          },
        ]
      : []),
    {
      title: 'System',
      items: [
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Sliders },
      ],
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-300 p-3 md:p-4 flex flex-col justify-between shrink-0">
      {/* Mobile: horizontally scrollable pill nav */}
      <nav aria-label="Primary" className="md:hidden -mx-1 px-1 flex gap-1.5 overflow-x-auto">
        {groups.flatMap((group) => group.items).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${
                    tab.badgeColor || 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* md+: vertical sidebar (original layout) */}
      <nav aria-label="Primary" className="hidden md:block space-y-5">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[10px] font-black mb-2 uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {tab.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${
                          tab.badgeColor || 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-8 p-3 bg-slate-50 border border-slate-300 hidden md:block">
        <div className="flex items-center space-x-2 text-xs font-black uppercase text-indigo-700 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AI Assistant</span>
        </div>
        <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
          Give the AI your plan and deadline. It drafts the execution plan, then checks
          actual GitHub &amp; Taiga progress against it.
        </p>
      </div>
    </aside>
  );
};

