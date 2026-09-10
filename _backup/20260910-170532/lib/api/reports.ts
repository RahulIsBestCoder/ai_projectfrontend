import { http } from './http';
import { fromApi, toApi } from './case';
import { API_BASE_URL } from './env';
import { rowsOf, safeRead } from './util';
import { ReportItem } from '@/types';

// Fixed template section labels (§ Reporting) — UI copy, not data.
const REPORT_SECTIONS = [
  'Executive Summary',
  'Health & Trend',
  'Velocity & Sprint',
  'Risks & Predictions',
  'Work Breakdown',
  'AI Narrative',
];

export const reportSections = () => REPORT_SECTIONS;

export async function listReports(projectId?: string): Promise<ReportItem[]> {
  return safeRead(async () => {
    const res = await http.get('/reports');
    const rows = rowsOf<ReportItem>(res.data);
    return projectId ? rows.filter((r) => r.projectId === projectId) : rows;
  }, [], 'reports.list');
}

export async function generateReportById(id: string): Promise<{ historyId: string; status: string }> {
  const res = await http.post(`/reports/${id}/generate`, {});
  return fromApi(res.data);
}

export async function getReportStatus(id: string): Promise<{ status: string; exportId?: string }> {
  const res = await http.get(`/reports/${id}/status`);
  return fromApi(res.data);
}

export function reportExportUrl(id: string, format: 'pdf' | 'ppt' | 'html') {
  return `${API_BASE_URL}/reports/${id}/export/${format}`;
}

export async function sendReport(id: string, recipientEmail: string) {
  const res = await http.post(`/reports/${id}/send`, toApi({ recipientEmail }));
  return fromApi(res.data);
}
