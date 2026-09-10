'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import { ReportItem } from '@/types';
import {
  listReports,
  createReport,
  deleteReport,
  reportSections,
  REPORT_TYPES,
  REPORT_PERIODS,
  REPORT_FORMATS,
} from '@/lib/api';

const STATUS_CLS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  pending: 'bg-slate-100 text-slate-600 border-slate-300',
  failed: 'bg-rose-100 text-rose-800 border-rose-300',
};

export const ReportsView: React.FC<{ projectId: string; onToast: (m: string) => void }> = ({
  projectId,
  onToast,
}) => {
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [period, setPeriod] = useState(REPORT_PERIODS[0]);
  const [format, setFormat] = useState<string>(REPORT_FORMATS[0]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => listReports(projectId).then(setReports);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createReport({
        projectId,
        name: name.trim(),
        definition: { type, period },
        format,
      });
      onToast('Report created');
      setName('');
      setShowNew(false);
      await load();
    } catch (err: any) {
      onToast(err?.msg || 'Could not create the report');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await deleteReport(id);
      onToast('Report deleted');
      await load();
    } catch (err: any) {
      onToast(err?.msg || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center justify-between text-indigo-700 text-xs font-black uppercase tracking-widest">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4" />
          <span>Reporting</span>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
        >
          {showNew ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showNew ? 'Close' : 'New report'}</span>
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="p-4 bg-white border-2 border-indigo-600 space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Report name — e.g. Weekly Health — Nova Platform"
            className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select label="Type" value={type} onChange={setType} options={REPORT_TYPES} />
            <Select label="Period" value={period} onChange={setPeriod} options={REPORT_PERIODS} />
            <Select label="Format" value={format} onChange={setFormat} options={[...REPORT_FORMATS]} />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Create report</span>
          </button>
        </form>
      )}

      <div className="p-4 bg-white border border-slate-300">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Template sections</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {reportSections().map((s) => (
            <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-600">
              {s}
            </span>
          ))}
        </div>
      </div>

      {reports === null ? (
        <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="p-10 bg-white border border-slate-300 text-center">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            No reports for this project
          </p>
          <p className="text-[10px] font-mono text-slate-400 mt-1">
            Click <span className="text-indigo-700 font-bold">New report</span> to add one.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-300">
          {reports.map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{r.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {r.format?.toUpperCase()}
                    {r.definition?.type ? ` • ${r.definition.type}` : ''}
                    {r.definition?.period ? ` • ${r.definition.period}` : ''} •{' '}
                    {r.generatedAt || r.createdAt
                      ? new Date(r.generatedAt || r.createdAt || '').toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${STATUS_CLS[r.status || 'pending']}`}>
                    {r.status || 'pending'}
                  </span>
                  <button
                    onClick={() => remove(r.id)}
                    disabled={deleting === r.id}
                    className="p-1 bg-white hover:bg-rose-50 border border-slate-300 disabled:opacity-50"
                    title="Delete report"
                  >
                    {deleting === r.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
      {label}
    </span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </label>
);
