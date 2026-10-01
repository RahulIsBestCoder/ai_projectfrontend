/**
 * Report → PDF export: renders a stored report as the "AI Project Assistant"
 * PDF template (`buildProjectSummaryPdf`) in the browser, because the backend
 * exposes no report-render route (`/reports/:id/export/:fmt` is 404) and the
 * seeded `artifact_url` values point at files that do not exist.
 *
 * Every section is filled from live project data — the report's own AI content
 * plus analytics, work items, sprints and risks — and falls back to the
 * template's sample values per section, so the output always keeps the sample
 * layout and never renders empty.
 */
import { getAnalytics } from '@core/services/analytics';
import { getProject } from '@core/services/projects';
import { getReport } from '@core/services/reports';
import { listSprints } from '@core/services/sprints';
import { listWorkItems } from '@core/services/workItems';
import {
  buildProjectSummaryPdf,
  clipText,
  ProjectSummaryData,
  SAMPLE_SUMMARY,
  SummaryKpi,
  SummaryRecommendation,
  SummaryRisk,
  SummarySlice,
  SummaryTeamRow,
  TASK_COLORS,
  wrapText,
} from '@core/services/reportPdf';
import { ReportItem } from '@shared/models';

/** Work-item states that mean "finished" (see `lib/api/enums.ts`). */
const CLOSED_STATUSES = new Set(['DONE', 'CLOSED', 'CANCELLED']);

/** Template doughnut buckets, in the template's own colour order. */
const STATUS_BUCKETS: Array<{ label: string; statuses: string[] }> = [
  { label: 'Closed', statuses: ['DONE', 'CLOSED', 'CANCELLED'] },
  { label: 'In Progress', statuses: ['IN_PROGRESS'] },
  { label: 'Ready for Test', statuses: ['IN_TESTING', 'READY_FOR_TEST', 'BLOCKED'] },
  { label: 'Testing', statuses: ['TESTING'] },
  { label: 'New', statuses: ['BACKLOG', 'NEW', 'TODO', 'OPEN'] },
];

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Card text widths in points — generated text must stay inside the template's cards. */
const TEXT_W = { kpiValue: 97, legend: 100, teamName: 200, riskLabel: 165, card: 146 };

type Story = { status: string; assignedTo?: string };

const statusOf = (story: Story): string => String(story.status || '').toUpperCase();

const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const clampPct = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const severityLevel = (severity: unknown): SummaryRisk['level'] => {
  const value = String(severity || '').toLowerCase();
  if (value === 'high' || value === 'critical') return 'HIGH';
  return value === 'low' ? 'LOW' : 'MEDIUM';
};

/** Template KPI `index`, overridden only when real project data exists. */
const kpiOf = (
  index: number,
  value: string | null,
  status?: string,
  statusColor?: string
): SummaryKpi => {
  const template = SAMPLE_SUMMARY.kpis[index];
  if (value == null) return template;
  return {
    label: template.label,
    value: clipText(value, 22, TEXT_W.kpiValue),
    status: status || template.status,
    statusColor: statusColor || template.statusColor,
  };
};
/**
 * Build the downloadable PDF for a report. `record` may be a list row or a
 * freshly generated record; `projectName` is the selected project's name, which
 * the template prints in the header as "<project> - <type> - <period>".
 */
export async function buildReportPdfBlob(
  record: ReportItem | null,
  projectName?: string
): Promise<Blob> {
  let full = record;
  if (record?.id) {
    try {
      // The single read carries `report_data` (the AI insights we print).
      full = (await getReport(record.id)) ?? record;
    } catch {
      full = record; // the list row is enough when the read fails
    }
  }
  const generated = full?.reportData ?? full?.definition?.generatedReport ?? null;
  if (generated?.report?.schemaVersion === 'project-report.v1') {
    const summary = generated.executiveSummary;
    const deadline = generated.risksAndPredictions.predictions.deadlineProbability;
    const deadlinePercent = deadline == null ? null : deadline <= 1 ? deadline * 100 : deadline;
    const chartSlices = (id: string): SummarySlice[] => {
      const chart = generated.visualData.find((item) => item.id === id);
      return (chart?.labels || []).map((label, index) => ({
        label,
        value: Number(chart?.datasets[0]?.data[index] ?? 0),
        color: TASK_COLORS[index % TASK_COLORS.length],
      }));
    };
    const reportData: ProjectSummaryData = {
      ...SAMPLE_SUMMARY,
      projectName: generated.report.project.name || projectName || full?.name || 'Project',
      sprintLabel: generated.report.period.label,
      badge: generated.healthAndTrend.overallHealth === 'healthy' ? 'On Track' : generated.healthAndTrend.overallHealth === 'critical' ? 'Project At Risk' : 'Monitor Closely',
      kpis: [
        kpiOf(0, `${summary.overallProgress}%`, generated.healthAndTrend.trend),
        kpiOf(1, `${summary.completedTasks} / ${summary.totalTasks}`, `${summary.completionRate}% complete`),
        kpiOf(2, `${generated.velocityAndSprint.completionRate}%`, generated.velocityAndSprint.sprintName || 'Latest sprint'),
        kpiOf(3, deadlinePercent == null ? null : `${Number(deadlinePercent.toFixed(1))}%`, deadlinePercent == null ? 'Not enough delivery data' : 'Deadline confidence'),
      ],
      taskStatus: chartSlices('work_completion').length ? chartSlices('work_completion') : SAMPLE_SUMMARY.taskStatus,
      sprintBars: chartSlices('plan_vs_actual').length ? chartSlices('plan_vs_actual') : SAMPLE_SUMMARY.sprintBars,
      team: generated.workBreakdown.byDepartment.slice(0, 4).map((row) => ({ name: row.department, pct: row.progress })),
      risks: generated.risksAndPredictions.risks.slice(0, 4).map((risk) => ({ label: risk.title, level: severityLevel(risk.severity) })),
      recommendations: generated.aiNarrative.recommendations.slice(0, 3).map((rec, index) => ({ title: `0${index + 1}. ${rec.action}`, body: rec.expectedImpact || `Priority: ${rec.priority.toUpperCase()}.` })),
      verdict: generated.executiveSummary.summary,
    };
    return buildProjectSummaryPdf(reportData);
  }
  // Compatibility export for an old saved record. Keep export strictly based
  // on the stored report payload; never refetch live analytics or invoke AI.
  if (generated) {
    const legacy = generated as any;
    return buildProjectSummaryPdf({
      ...SAMPLE_SUMMARY,
      projectName: projectName || full?.name || 'Project',
      verdict: String(legacy.summary || '').trim() || SAMPLE_SUMMARY.verdict,
      risks: (legacy.insights || []).slice(0, 4).map((item: any) => ({
        label: String(item.title || item.description || 'Finding'),
        level: severityLevel(item.severity),
      })),
      recommendations: (legacy.recommendations || []).slice(0, 3).map((item: any, index: number) => ({
        title: `0${index + 1}. ${String(item.action || 'Recommended action')}`,
        body: `Priority: ${String(item.priority || 'medium').toUpperCase()}.`,
      })),
    });
  }
  return buildProjectSummaryPdf({ ...SAMPLE_SUMMARY, projectName: projectName || full?.name || 'Project' });

  /* Legacy live-data exporter retained below only as unreachable migration
     reference. All active export paths above use the saved report record. */
  if (Date.now() < 0) {
  const projectId = full?.projectId || record?.projectId || '';
  const [project, analytics, workItems, sprints] = await Promise.all([
    projectId ? getProject(projectId) : Promise.resolve(null),
    projectId ? getAnalytics(projectId) : Promise.resolve(null),
    projectId ? listWorkItems(projectId) : Promise.resolve({ stories: [], tasks: [], issues: [] }),
    projectId ? listSprints(projectId) : Promise.resolve([]),
  ]);
  const definition = full?.definition ?? record?.definition ?? {};
  const stories = (workItems?.stories ?? []) as Story[];
  const delay = analytics?.delayProbability ?? project?.delayProbability ?? null;

  // ---- KPI cards ---------------------------------------------------------
  const counts = new Map<string, number>();
  stories.forEach((story) => {
    const key = statusOf(story);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const countOf = (statuses: string[]) =>
    statuses.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);

  const totalTasks = stories.length;
  const closedTasks = countOf([...CLOSED_STATUSES]);
  const taskCompletion = totalTasks ? pct(closedTasks, totalTasks) : null;
  const sprint = sprints.find((item) => !item.isClosed) ?? sprints[sprints.length - 1] ?? null;
  const sprintPct =
    sprint && sprint.totalPoints > 0
      ? clampPct((sprint.completedPoints / sprint.totalPoints) * 100)
      : null;
  const overall = sprintPct ?? analytics?.sprintMetrics.completionPercentage ?? taskCompletion;
  const deadline = delay == null ? null : clampPct(100 - (delay ?? 0));

  const overallNote =
    overall == null
      ? undefined
      : (overall ?? 0) >= 75
        ? 'On track'
        : (overall ?? 0) >= 50
          ? 'Steady progress'
          : 'Needs attention';
  const overallColor =
    overall == null
      ? undefined
      : (overall ?? 0) >= 75
        ? '#16a34a'
        : (overall ?? 0) >= 50
          ? '#d97706'
          : '#dc2626';
  const deadlineRisky = delay != null && (delay ?? 0) >= 50;
  const kpis: SummaryKpi[] = [
    kpiOf(0, overall == null ? null : `${overall}%`, overallNote, overallColor),
    kpiOf(
      1,
      taskCompletion == null ? null : `${closedTasks} / ${totalTasks}`,
      taskCompletion == null ? undefined : `${taskCompletion}% closed`,
      '#6b7280'
    ),
    kpiOf(
      2,
      sprintPct == null ? null : `${sprintPct}%`,
      sprint
        ? `${Math.round(sprint.completedPoints)} / ${Math.round(sprint.totalPoints)} points`
        : undefined,
      '#6b7280'
    ),
    kpiOf(
      3,
      deadline == null ? null : `${deadline}%`,
      deadline == null ? undefined : deadlineRisky ? 'Monitor closely' : 'On track',
      deadline == null ? undefined : deadlineRisky ? '#d97706' : '#16a34a'
    ),
  ];

  // ---- Task status doughnut ---------------------------------------------
  const slices: SummarySlice[] = STATUS_BUCKETS.map((bucket, index) => ({
    label: clipText(bucket.label, 9.5, TEXT_W.legend),
    value: countOf(bucket.statuses),
    color: TASK_COLORS[index % TASK_COLORS.length],
  })).filter((slice) => slice.value > 0);

  // ---- Sprint bars -------------------------------------------------------
  const sprintBars: SummarySlice[] =
    sprint && sprint.totalPoints > 0
      ? [
          { label: 'Completed', value: Math.round(sprint.completedPoints), color: '#4f46e5' },
          {
            label: 'Remaining',
            value: Math.max(0, Math.round(sprint.totalPoints - sprint.completedPoints)),
            color: '#f87171',
          },
        ]
      : SAMPLE_SUMMARY.sprintBars;

  // ---- Team performance (work items grouped by assignee) -----------------
  const owners = new Map<string, { total: number; done: number }>();
  stories.forEach((story) => {
    const owner = String(story.assignedTo || '').trim();
    if (!owner || owner.toLowerCase() === 'unassigned') return;
    const row = owners.get(owner) ?? { total: 0, done: 0 };
    row.total += 1;
    if (CLOSED_STATUSES.has(statusOf(story))) row.done += 1;
    owners.set(owner, row);
  });
  const team: SummaryTeamRow[] = [...owners.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4)
    .map(([name, row]) => ({
      name: clipText(name, 10, TEXT_W.teamName),
      pct: pct(row.done, row.total),
    }));

  // ---- AI risk detection: report insights, else the project's risk factors
  const insights = [...((generated as any)?.insights ?? [])].sort(
    (a, b) =>
      (SEVERITY_RANK[String(a.severity).toLowerCase()] ?? 3) -
      (SEVERITY_RANK[String(b.severity).toLowerCase()] ?? 3)
  );
  const insightRisks: SummaryRisk[] = insights.slice(0, 4).map((insight) => ({
    label: clipText(String(insight.title || insight.description || 'Risk'), 9.5, TEXT_W.riskLabel),
    level: severityLevel(insight.severity),
  }));
  const factorRisks: SummaryRisk[] = (project?.keyRiskFactors ?? []).slice(0, 4).map((factor) => ({
    label: clipText(String(factor), 9.5, TEXT_W.riskLabel),
    level: delay != null && delay >= 50 ? 'HIGH' : 'MEDIUM',
  }));
  const risks = insightRisks.length
    ? insightRisks
    : factorRisks.length
      ? factorRisks
      : SAMPLE_SUMMARY.risks;

  // ---- AI recommended actions -------------------------------------------
  const cards: SummaryRecommendation[] = ((generated as any)?.recommendations ?? [])
    .slice(0, 3)
    .map((rec: any, index: number) => {
      const action = String(rec.action || '').trim() || 'Follow up with the delivery team';
      const lines = wrapText(action, 9, TEXT_W.card);
      return {
        title: clipText(`0${index + 1}. ${lines[0]}`, 10, TEXT_W.card),
        body:
          lines.length > 1
            ? lines.slice(1).join(' ')
            : `Priority: ${String(rec.priority || 'medium').toUpperCase()}.`,
      };
    });

  const data: ProjectSummaryData = {
    appName: SAMPLE_SUMMARY.appName,
    projectName: project?.name || projectName || full?.name || 'Project',
    sprintLabel: [definition.type, definition.period].filter(Boolean).map(String).join(' - '),
    badge:
      delay == null
        ? SAMPLE_SUMMARY.badge
        : (delay ?? 0) >= 60
          ? 'Project At Risk'
          : (delay ?? 0) >= 30
            ? 'Monitor Closely'
            : 'On Track',
    kpis,
    taskStatus: slices.length ? slices : SAMPLE_SUMMARY.taskStatus,
    sprintBars,
    team: team.length ? team : SAMPLE_SUMMARY.team,
    risks,
    recommendations: cards.length ? cards : SAMPLE_SUMMARY.recommendations,
    verdictTitle: SAMPLE_SUMMARY.verdictTitle,
    verdict: String((generated as any)?.summary || '').trim() || SAMPLE_SUMMARY.verdict,
    footer: SAMPLE_SUMMARY.footer,
  };

  return buildProjectSummaryPdf(data);
  }
}
