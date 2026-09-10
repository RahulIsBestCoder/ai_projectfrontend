'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Play, Mail, Download } from 'lucide-react';
import { ReportItem } from '@/types';
import {
  listReports,
  generateReportById,
  getReportStatus,
  reportExportUrl,
  sendReport,
  reportSections,
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
  const [busy, setBusy] = useState<string | null>(null);
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');

  const load = () => listReports(projectId).then(setReports);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const generate = async (id: string) => {
    setBusy(id);
    try {
      await generateReportById(id);
      onToast('Report generation started');
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 900));
        const { status } = await getReportStatus(id);
        if (status === 'completed' || status === 'failed') break;
      }
      await load();
      onToast('Report ready');
    } catch (err: any) {
      onToast(err?.msg || 'Report generation unavailable');
    } finally {
      setBusy(null);
    }
  };

  const send = async (id: string) => {
    if (!recipient.trim()) return;
    try {
      await sendReport(id, recipient);
      onToast(`Report sent to ${recipient}`);
      setEmailFor(null);
      setRecipient('');
    } catch (err: any) {
      onToast(err?.msg || 'Send failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
        <FileText className="w-4 h-4" />
        <span>Reporting</span>
      </div>

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
      ) : (
        <div className="bg-white border border-slate-300">
          {reports.map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{r.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {r.format?.toUpperCase()} • {r.generatedAt ? new Date(r.generatedAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase border ${STATUS_CLS[r.status || 'pending']}`}>
                    {r.status || 'pending'}
                  </span>
                  <button
                    onClick={() => generate(r.id)}
                    disabled={busy === r.id}
                    className="flex items-center space-x-1 px-2 py-1 bg-slate-900 hover:bg-black text-white text-[10px] font-bold uppercase tracking-wider border border-black disabled:opacity-50"
                  >
                    {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span>Generate</span>
                  </button>
                  <button
                    onClick={() => setEmailFor(emailFor === r.id ? null : r.id)}
                    className="p-1 bg-white hover:bg-slate-100 border border-slate-300"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>

              {r.status === 'completed' && (
                <div className="mt-2 flex gap-2">
                  {(['pdf', 'ppt', 'html'] as const).map((f) => (
                    <a
                      key={f}
                      href={reportExportUrl(r.id, f)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                    >
                      <Download className="w-3 h-3 text-indigo-600" />
                      <span>{f}</span>
                    </a>
                  ))}
                </div>
              )}

              {emailFor === r.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="recipient@company.com"
                    className="flex-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
                  />
                  <button
                    onClick={() => send(r.id)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold uppercase tracking-wider border border-black"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
