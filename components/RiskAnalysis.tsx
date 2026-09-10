'use client';

import React, { useEffect, useState } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { ShieldAlert, Loader2, Play, Target, CalendarClock } from 'lucide-react';
import { ProjectRiskRow, RiskAnalyzeResult, CompletionForecast, AIPrediction } from '@/types';
import {
  listRisks,
  analyzeRisk,
  predictDeadline,
  getCompletionForecast,
  getRiskPrediction,
} from '@/lib/api';

const SEV_CLS: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
  HIGH: 'bg-rose-100 text-rose-800 border-rose-300',
  CRITICAL: 'bg-rose-200 text-rose-900 border-rose-400',
};

const LEVEL_FILL: Record<string, string> = { LOW: '#059669', MEDIUM: '#d97706', HIGH: '#e11d48' };

export const RiskAnalysis: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [risks, setRisks] = useState<ProjectRiskRow[] | null>(null);
  const [analysis, setAnalysis] = useState<RiskAnalyzeResult | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [forecast, setForecast] = useState<CompletionForecast | null>(null);
  const [running, setRunning] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [deadlineProb, setDeadlineProb] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRisks(null);
      const [r, p, f] = await Promise.all([
        listRisks(projectId),
        getRiskPrediction(projectId),
        getCompletionForecast(projectId),
      ]);
      if (!alive) return;
      setRisks(r);
      setPrediction(p);
      setForecast(f);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await analyzeRisk(projectId);
      setAnalysis(res);
      onToast(`Risk analysis complete — ${res.level} (${Math.round(res.score * 100)}%)`);
    } catch (err: any) {
      onToast(err?.msg || 'Risk analysis endpoint unavailable');
    } finally {
      setRunning(false);
    }
  };

  const checkDeadline = async () => {
    if (!targetDate) return;
    try {
      const { probability } = await predictDeadline(projectId, targetDate);
      setDeadlineProb(probability);
    } catch (err: any) {
      onToast(err?.msg || 'Deadline prediction unavailable');
    }
  };

  if (!risks) {
    return (
      <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading risk register…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4" />
          <span>Risk &amp; Prediction</span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>Run analysis</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk list */}
        <div className="lg:col-span-2 p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
            Risk register
          </h3>
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="p-3 bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-800 leading-snug">{r.description}</p>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{r.riskType}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${SEV_CLS[r.severity]}`}>
                    {r.severity}
                  </span>
                  <span className={`text-[10px] font-mono ${r.mitigated ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {r.mitigated ? 'mitigated' : 'open'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Score dial + signals */}
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3">
            Composite score
          </h3>
          {analysis ? (
            <>
              <div className="relative w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="72%"
                    outerRadius="100%"
                    data={[{ value: Math.round(analysis.score * 100), fill: LEVEL_FILL[analysis.level] }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={0} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-900">{Math.round(analysis.score * 100)}%</span>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500">{analysis.level}</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {Object.entries(analysis.signals).map(([k, v]) => {
                  const pct = Math.min(100, Math.abs(Number(v)) * (k.includes('days') ? 8 : 60));
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>{k}</span>
                        <span className={k === analysis.topDriver ? 'text-rose-600 font-bold' : ''}>{String(v)}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${pct}%`, backgroundColor: k === analysis.topDriver ? '#e11d48' : '#4f46e5' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 font-mono py-10 text-center uppercase tracking-wider">
              Run analysis to compute the composite risk score
            </p>
          )}
        </div>
      </div>

      {/* Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3 flex items-center">
            <Target className="w-4 h-4 text-indigo-600 mr-2" /> Completion forecast
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {forecast &&
              (['p50', 'p80', 'p95'] as const).map((p) => (
                <div key={p} className="p-2.5 bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400">{p}</span>
                  <div className="text-xs font-black text-slate-900 mt-1">
                    {new Date(forecast[p]).toLocaleDateString()}
                  </div>
                </div>
              ))}
          </div>
          {prediction && (
            <div className="text-[11px] font-mono text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>AI predicted finish</span>
                <span className="font-bold text-slate-900">
                  {new Date(prediction.predictedFinishDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Confidence</span>
                <span className="font-bold text-slate-900">{prediction.confidence}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-3 flex items-center">
            <CalendarClock className="w-4 h-4 text-indigo-600 mr-2" /> Deadline probability
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
            <button
              onClick={checkDeadline}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
            >
              Check
            </button>
          </div>
          {deadlineProb !== null && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Probability of hitting target</span>
                <span
                  className={`text-2xl font-black ${
                    deadlineProb >= 0.7 ? 'text-emerald-600' : deadlineProb >= 0.4 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {Math.round(deadlineProb * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 mt-1">
                <div className="h-full bg-indigo-600" style={{ width: `${deadlineProb * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
