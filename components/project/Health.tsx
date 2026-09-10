'use client';

import React from 'react';
import { GaugeCircle } from 'lucide-react';
import { ProjectAnalytics } from '@/components/ProjectAnalytics';
import { RiskAnalysis } from '@/components/RiskAnalysis';

interface HealthProps {
  projectId: string;
  organizationId?: string;
  onToast: (m: string) => void;
}

/**
 * Health — the core intelligence page: is the project going in the right
 * direction to meet the deadline? Merges the former Analytics & Health and
 * Risk & Prediction tabs (Simplified Frontend Plan §10–11).
 */
export const Health: React.FC<HealthProps> = ({ projectId, organizationId, onToast }) => {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <GaugeCircle className="w-4 h-4" />
        <span>Project Health &amp; Deadline</span>
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
          Health components &amp; trend
        </h2>
        <ProjectAnalytics projectId={projectId} organizationId={organizationId} onToast={onToast} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit">
          Risk &amp; deadline prediction
        </h2>
        <RiskAnalysis projectId={projectId} onToast={onToast} />
      </section>
    </div>
  );
};
