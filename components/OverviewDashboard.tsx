'use client';

import React from 'react';
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  Code2,
  Bug,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Flame,
  Brain,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Project, AIPrediction } from '@/types';
import { CalculatedAnalytics } from '@/lib/analytics/calculator';

interface OverviewDashboardProps {
  project: Project;
  analytics: CalculatedAnalytics;
  prediction: AIPrediction | null;
  onNavigateToAi: () => void;
  onNavigateToSync: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  project,
  analytics,
  prediction,
  onNavigateToAi,
  onNavigateToSync,
}) => {
  const delayRisk = prediction ? prediction.delayProbability : project.delayProbability;
  const healthScore = prediction ? prediction.projectHealth : project.healthScore;

  const getRiskBadge = (risk: number) => {
    if (risk > 70) {
      return {
        label: 'CRITICAL RISK OF DELAY',
        bg: 'bg-rose-100 border-rose-300 text-rose-800',
        ring: 'border-rose-500 text-rose-700',
      };
    }
    if (risk > 40) {
      return {
        label: 'MODERATE RISK',
        bg: 'bg-amber-100 border-amber-300 text-amber-800',
        ring: 'border-amber-500 text-amber-700',
      };
    }
    return {
      label: 'ON TRACK',
      bg: 'bg-emerald-100 border-emerald-300 text-emerald-800',
      ring: 'border-emerald-500 text-emerald-700',
    };
  };

  const riskBadge = getRiskBadge(delayRisk);

  return (
    <div className="space-y-6">
      {/* Top Banner: Project Title & Quick Stats */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${riskBadge.bg}`}>
                {riskBadge.label}
              </span>
              <span className="text-[10px] text-slate-500 font-mono uppercase flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Last Synced: {new Date(project.lastSyncAt).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="text-xl font-black italic tracking-tighter text-slate-900">{project.name}</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl font-sans">{project.description}</p>
          </div>

          {/* Forecast vs Deadline */}
          <div className="flex items-center space-x-4 bg-slate-50 p-4 border border-slate-300">
            <div className="text-center px-3 border-r border-slate-300">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                Planned Deadline
              </span>
              <div className="flex items-center text-slate-900 font-mono font-bold text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {new Date(project.deadline).toLocaleDateString()}
              </div>
            </div>
            <div className="text-center px-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                AI Predicted Finish
              </span>
              <div
                className={`flex items-center font-mono font-bold text-xs ${
                  delayRisk > 50 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                <Flame className="w-3.5 h-3.5 mr-1.5" />
                {prediction
                  ? new Date(prediction.predictedFinishDate).toLocaleDateString()
                  : ' Calculating...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Health Meter & Key KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Health Meter */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Health Score
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-4 flex items-center justify-between">
            <div className="text-3xl font-black text-slate-900">{healthScore}</div>
            <div className="text-[10px] font-mono font-bold text-slate-500 text-right">
              / 100
              <div className="w-20 bg-slate-200 h-2 mt-1.5 overflow-hidden">
                <div
                  className={`h-full ${
                    healthScore > 80
                      ? 'bg-emerald-600'
                      : healthScore > 50
                      ? 'bg-amber-500'
                      : 'bg-rose-600'
                  }`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Commit churn, PR latency &amp; sprint points.
          </p>
        </div>

        {/* AI Delivery Delay Risk */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center">
              <Brain className="w-3.5 h-3.5 mr-1" />
              AI Delay Risk
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="my-4 flex items-baseline justify-between">
            <div
              className={`text-3xl font-black ${
                delayRisk > 70
                  ? 'text-rose-600'
                  : delayRisk > 40
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {delayRisk}%
            </div>
            <button
              onClick={onNavigateToAi}
              className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider flex items-center"
            >
              Explain AI
              <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Confidence: <span className="text-slate-900 font-bold">{prediction ? `${prediction.confidence}%` : '—'}</span>
          </p>
        </div>

        {/* PR Review Latency */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              PR Review Latency
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-4">
            <div className="text-3xl font-black text-slate-900">
              {analytics.prMetrics.avgReviewTimeHours} hrs
            </div>
            {analytics.prMetrics.stalePrCount > 0 && (
              <span className="inline-block mt-1 text-[9px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                {analytics.prMetrics.stalePrCount} Stale (&gt;24h)
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Healthy benchmark: &lt;12h turnaround.
          </p>
        </div>

        {/* Code Churn */}
        <div className="p-5 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Code Churn
            </span>
            <Code2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="my-4">
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-base font-black text-emerald-600">
                +{analytics.codeChurn.additions.toLocaleString()}
              </span>
              <span className="text-base font-black text-rose-600">
                -{analytics.codeChurn.deletions.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Churn ratio: <span className="font-bold text-slate-900">{analytics.codeChurn.churnRatio}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Refactoring vs feature addition.
          </p>
        </div>
      </div>

      {/* Main Content Grid: Velocity Chart & Key Risk Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Velocity Chart (2 Columns) */}
        <div className="lg:col-span-2 p-6 bg-white border border-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
                <TrendingDown className="w-4 h-4 text-indigo-600 mr-2" />
                Sprint Velocity &amp; Story Points
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Planned vs Completed velocity points
              </p>
            </div>
            <span className="px-2 py-1 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-800">
              Active Sprint: {analytics.sprintMetrics.completionPercentage}% Done
            </span>
          </div>

          {/* Recharts Bar Chart */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sprintMetrics.velocityHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="sprintName" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0px',
                    color: '#0f172a',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend />
                <Bar dataKey="planned" name="Planned Points" fill="#4f46e5" />
                <Bar dataKey="completed" name="Completed Points" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Risk Factors & AI Recommendations (1 Column) */}
        <div className="p-6 bg-white border border-slate-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
                <AlertTriangle className="w-4 h-4 text-amber-600 mr-2" />
                Active Risk Factors
              </h3>
              <button
                onClick={onNavigateToAi}
                className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
              >
                Deep AI
              </button>
            </div>

            <div className="space-y-3">
              {project.keyRiskFactors.map((risk, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-50 border border-slate-200 flex items-start space-x-2.5"
                >
                  <div className="w-2 h-2 rounded-full bg-rose-600 mt-1 shrink-0" />
                  <p className="text-xs text-slate-800 leading-relaxed font-sans">{risk}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-300">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
              <span>QA Bottleneck Ratio:</span>
              <span className="font-bold text-indigo-700">{analytics.qaCapacity.ratio}</span>
            </div>
            <button
              onClick={onNavigateToSync}
              className="mt-3 w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest transition border border-black"
            >
              Trigger 15-Min Data Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
