'use client';

import React from 'react';
import {
  BarChart3,
  Brain,
  GitCommitHorizontal,
  Kanban,
  Users,
  Repeat,
  Sparkles,
  LayoutGrid,
  GaugeCircle,
  Activity,
  ShieldAlert,
  Plug,
  FileText,
  Building2,
} from 'lucide-react';

export type TabType =
  | 'portfolio'
  | 'overview'
  | 'workitems'
  | 'sprints'
  | 'github'
  | 'analytics'
  | 'risks'
  | 'ai'
  | 'reports'
  | 'plans'
  | 'departments'
  | 'integrations'
  | 'sync'
  | 'admin'
  ;

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  delayRisk: number;
  isAdmin?: boolean;
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
  isAdmin = true,
}) => {
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: '01. Organisation',
      items: [{ id: 'portfolio', label: 'Portfolio', icon: LayoutGrid }],
    },
    {
      title: '02. Project Workspace',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
        { id: 'workitems', label: 'Work Items', icon: Kanban },
        { id: 'sprints', label: 'Sprint Intelligence', icon: GaugeCircle },
        { id: 'github', label: 'GitHub Engineering', icon: GitCommitHorizontal },
        { id: 'analytics', label: 'Analytics & Health', icon: Activity },
        {
          id: 'risks',
          label: 'Risk & Prediction',
          icon: ShieldAlert,
          badge: delayRisk > 50 ? `${delayRisk}%` : null,
          badgeColor: delayRisk > 70 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300',
        },
        { id: 'ai', label: 'AI Assistant', icon: Brain },
        { id: 'plans', label: 'AI Sprint Planner', icon: Sparkles },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'departments', label: 'Department Health', icon: Users },
      ],
    },
    {
      title: '03. Operations',
      items: [
        { id: 'integrations', label: 'Integrations', icon: Plug },
        { id: 'sync', label: 'Sync Pipeline', icon: Repeat, badge: 'Live', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: '04. Configuration',
            items: [{ id: 'admin' as TabType, label: 'Administration', icon: Building2 }],
          },
        ]
      : []),
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-300 p-4 flex flex-col justify-between shrink-0">
      <nav className="space-y-5">
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
          <span>AI Architecture</span>
        </div>
        <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
          Gemini engine powers delivery-risk prediction, sprint drafting, and team scorecards.
        </p>
      </div>
    </aside>
  );
};
