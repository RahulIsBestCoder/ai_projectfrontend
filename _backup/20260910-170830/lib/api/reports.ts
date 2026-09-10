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
  return safeRead(
    async () => {
      // The backend honours ?project_id= (server-side filter, no pagination loss).
      // Also request a big page so an unfiltered call isn't capped at 20.
      const res = await http.get('/reports', {
        params: projectId ? { project_id: projectId, limit: 200 } : { limit: 200 },
      });
      const rows = rowsOf<ReportItem>(res.data);
      // Belt-and-suspenders in case a deployment ignores the query param.
      return projectId ? rows.filter((r) => r.projectId === projectId) : rows;
    },
    [],
    'reports.list',
  );
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
