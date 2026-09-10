import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, safeRead } from './util';
import { ReportItem } from '@/types';

/**
 * Live report routes (verified):
 *   POST   /v1/reports          create   { project_id, name, definition?, format?, status? }
 *   GET    /v1/reports          list     (?project_id= &limit= &page=)
 *   GET    /v1/reports/:id      read one
 *   PUT    /v1/reports/:id      update   (name | definition | format | status | artifact_url)
 *   DELETE /v1/reports/:id      soft delete
 *
 * NOT built: /reports/:id/generate, /status, /export/:fmt, /send (all 404).
 * A completed report exposes its file via the `artifact_url` field.
 */

// Fixed template section labels — UI copy, not data.
const REPORT_SECTIONS = [
  'Executive Summary',
  'Health & Trend',
  'Velocity & Sprint',
  'Risks & Predictions',
  'Work Breakdown',
  'AI Narrative',
];
export const reportSections = () => REPORT_SECTIONS;

export const REPORT_TYPES = ['health_check', 'risk_assessment', 'progress_report', 'sprint_review'];
export const REPORT_PERIODS = ['weekly', 'monthly', 'sprint'];
export const REPORT_FORMATS = ['pdf', 'html', 'ppt'] as const;

export async function listReports(projectId?: string): Promise<ReportItem[]> {
  return safeRead(
    async () => {
      const res = await http.get('/reports', {
        params: projectId ? { project_id: projectId, limit: 200 } : { limit: 200 },
      });
      const rows = rowsOf<ReportItem>(res.data);
      return projectId ? rows.filter((r) => r.projectId === projectId) : rows;
    },
    [],
    'reports.list',
  );
}

export async function createReport(body: {
  projectId: string;
  name: string;
  definition?: { type?: string; period?: string };
  format?: string;
  status?: string;
}): Promise<ReportItem> {
  const res = await http.post('/reports', toApi(body));
  return fromApi(res.data) as ReportItem;
}

export async function updateReport(id: string, body: Partial<ReportItem>) {
  const res = await http.put(`/reports/${id}`, toApi(body));
  return res.data;
}

export async function deleteReport(id: string) {
  const res = await http.delete(`/reports/${id}`);
  return res.data;
}
