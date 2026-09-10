'use client';

import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Sliders,
  Send,
  Zap,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Bot,
  HelpCircle,
} from 'lucide-react';
import { AIPrediction, AIProviderName } from '@/types';
import { CalculatedAnalytics } from '@/lib/analytics/calculator';
import { askAiAssistant } from '@/lib/api';

interface AiIntelligenceProps {
  projectId: string;
  prediction: AIPrediction | null;
  analytics: CalculatedAnalytics;
  onRunPrediction: (customPrompt?: string, provider?: AIProviderName) => Promise<void>;
  isPredicting: boolean;
  activeProvider: AIProviderName;
}

export const AiIntelligence: React.FC<AiIntelligenceProps> = ({
  projectId,
  prediction,
  analytics,
  onRunPrediction,
  isPredicting,
  activeProvider,
}) => {
  // Simulator State Sliders
  const [prDelayHours, setPrDelayHours] = useState(analytics.prMetrics.avgReviewTimeHours);
  const [sprintDeficit, setSprintDeficit] = useState(100 - analytics.sprintMetrics.completionPercentage);
  const [criticalBugs, setCriticalBugs] = useState(analytics.bugMetrics.criticalBugs);
  const [qaCapacity, setQaCapacity] = useState(analytics.qaCapacity.capacityPercentage);
  
  // Custom AI Query
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiAnswers, setAiAnswers] = useState<{ query: string; answer: string; time: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const delayProb = prediction ? prediction.delayProbability : analytics.delayProbability;

  const handleSimulate = async () => {
    const prompt = `Simulation Scenario: PR review latency is adjusted to ${prDelayHours} hours, sprint deficit is ${sprintDeficit}%, critical open bugs count is ${criticalBugs}, and QA capacity percentage is ${qaCapacity}%. Recalculate delivery delay risk and team recommendations.`;
    await onRunPrediction(prompt);
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setIsAsking(true);
    const query = customPrompt;
    setCustomPrompt('');

    try {
      const data = await askAiAssistant(
        `User question about project risks: "${query}". Answer in 2-3 direct sentences with actionable advice.`,
        projectId
      );

      setAiAnswers((prev) => [
        {
          query,
          answer: data.answer || data.response || 'No answer returned by the AI service.',
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      setAiAnswers((prev) => [
        {
          query,
          answer: `Request failed: ${err?.msg || err?.message || 'AI service unavailable'}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white border-2 border-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest mb-1">
              <Brain className="w-4 h-4" />
              <span>AI Delivery Risk &amp; Recommendation Engine</span>
            </div>
            <h2 className="text-xl font-black italic tracking-tighter text-slate-900">Predictive Intelligence Center</h2>
            <p className="text-xs text-slate-600 mt-1 font-sans">
              Powered by <span className="text-indigo-700 font-bold">{prediction?.aiProviderUsed || activeProvider}</span> •
              Continuous machine learning analysis of GitHub commits, PRs, and Taiga metrics.
            </p>
          </div>

          <button
            onClick={() => onRunPrediction()}
            disabled={isPredicting}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest transition border border-black disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPredicting ? 'animate-spin' : ''}`} />
            <span>{isPredicting ? 'Running AI Model...' : 'Recalculate AI Model'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Delay Prediction Meter & Risk Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Ring & Gauge (1 Column) */}
        <div className="p-6 bg-white border border-slate-300 flex flex-col justify-between items-center text-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
            Predicted Delivery Delay Probability
          </span>

          <div className="relative my-4 flex items-center justify-center">
            <div
              className={`w-40 h-40 border-4 flex flex-col items-center justify-center bg-slate-50 ${
                delayProb > 70
                  ? 'border-rose-600 text-rose-800'
                  : delayProb > 40
                  ? 'border-amber-500 text-amber-800'
                  : 'border-emerald-600 text-emerald-800'
              }`}
            >
              <span className="text-4xl font-black text-slate-900">{delayProb}%</span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider mt-1">
                {delayProb > 70 ? 'High Delay Risk' : delayProb > 40 ? 'Moderate Risk' : 'On Schedule'}
              </span>
            </div>
          </div>

          <div className="w-full space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
              <span>Predicted Finish Date:</span>
              <span className="font-bold text-rose-700">
                {prediction ? new Date(prediction.predictedFinishDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-slate-700 bg-slate-50 p-2 border border-slate-200">
              <span>AI Confidence Score:</span>
              <span className="font-bold text-indigo-700">
                {prediction ? `${prediction.confidence}%` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Risk Simulator Sliders (2 Columns) */}
        <div className="lg:col-span-2 p-6 bg-white border border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit flex items-center">
              <Sliders className="w-4 h-4 text-indigo-600 mr-2" />
              What-If Scenario Risk Simulator
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Adjust parameters &amp; test sensitivity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
            {/* Slider 1: PR Delay */}
            <div>
              <div className="flex justify-between text-xs font-mono font-bold text-slate-800 mb-1">
                <span>PR Review Latency (Hours)</span>
                <span className="text-indigo-700 font-black">{prDelayHours} hrs</span>
              </div>
              <input
                type="range"
                min="2"
                max="96"
                value={prDelayHours}
                onChange={(e) => setPrDelayHours(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Slider 2: Sprint Velocity Deficit */}
            <div>
              <div className="flex justify-between text-xs font-mono font-bold text-slate-800 mb-1">
                <span>Sprint Velocity Deficit (%)</span>
                <span className="text-amber-700 font-black">{sprintDeficit}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={sprintDeficit}
                onChange={(e) => setSprintDeficit(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Slider 3: Critical Bugs */}
            <div>
              <div className="flex justify-between text-xs font-mono font-bold text-slate-800 mb-1">
                <span>Critical Bugs Count</span>
                <span className="text-rose-700 font-black">{criticalBugs} bugs</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={criticalBugs}
                onChange={(e) => setCriticalBugs(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 accent-rose-600 cursor-pointer"
              />
            </div>

            {/* Slider 4: QA Capacity */}
            <div>
              <div className="flex justify-between text-xs font-mono font-bold text-slate-800 mb-1">
                <span>QA Test Capacity (%)</span>
                <span className="text-emerald-700 font-black">{qaCapacity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={qaCapacity}
                onChange={(e) => setQaCapacity(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSimulate}
              disabled={isPredicting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
            >
              Simulate Scenario Prediction
            </button>
          </div>
        </div>
      </div>

      {/* Feature Importance & Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Importance Breakdown */}
        <div className="p-6 bg-white border border-slate-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
            <Zap className="w-4 h-4 text-indigo-600 mr-2" />
            Explainable AI (XAI) Feature Importances
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mb-4">
            Weighted drivers increasing or decreasing delivery risk
          </p>

          <div className="space-y-4">
            {prediction?.featureImportances.map((f, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-mono font-bold text-slate-900">
                  <span>{f.feature}</span>
                  <span className="text-indigo-700">+{f.weight}% Weight</span>
                </div>
                <div className="w-full bg-slate-200 h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full"
                    style={{ width: `${Math.min(100, Math.max(10, f.weight * 2.5))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 font-sans">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Action Recommendations */}
        <div className="p-6 bg-white border border-slate-300 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1 w-fit mb-1 flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2" />
              AI Action Plan &amp; Recommendations
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mb-4">
              Automated mitigation steps generated by Gemini 3.6 Flash
            </p>

            <div className="space-y-3">
              {prediction?.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-50 border border-slate-200 flex items-start space-x-3"
                >
                  <div className="w-5 h-5 bg-indigo-600 text-white flex items-center justify-center shrink-0 font-mono font-bold text-xs mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-slate-800 font-sans leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-300 flex items-center justify-between text-xs font-mono text-slate-600">
            <span>Model Provider:</span>
            <span className="font-bold text-indigo-700">{prediction?.aiProviderUsed}</span>
          </div>
        </div>
      </div>

      {/* Interactive AI Prompt Debugger & Q&A Box */}
      <div className="p-6 bg-white border border-slate-300 space-y-4">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-indigo-600 pb-1">
            Ask AI Ops Assistant
          </h3>
        </div>
        <p className="text-[10px] text-slate-500 font-mono">
          Query the AI agent regarding specific code churn metrics, developer bottlenecks, or timeline adjustments.
        </p>

        <form onSubmit={handleAskAI} className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g., How can we reduce PR review delay without overloading the Tech Lead?"
            className="flex-1 bg-slate-50 border border-slate-300 px-4 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
          />
          <button
            type="submit"
            disabled={isAsking || !customPrompt.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </form>

        {aiAnswers.length > 0 && (
          <div className="space-y-3 pt-2">
            {aiAnswers.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-300 space-y-1">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-indigo-700">
                  <span>Q: {item.query}</span>
                  <span className="text-slate-500 text-[10px]">{item.time}</span>
                </div>
                <p className="text-xs text-slate-800 font-sans leading-relaxed pt-1">{item.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
