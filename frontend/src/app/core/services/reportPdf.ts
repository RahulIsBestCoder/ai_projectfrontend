/**
 * Styled, dependency-free "AI Project Assistant — Project Summary" PDF
 * (PDF 1.4, Helvetica / Helvetica-Bold, US Letter portrait).
 *
 * Everything is rendered with native PDF vector operators — no canvas, no
 * raster, no external libraries: KPI cards, a task-status doughnut chart and a
 * sprint bar chart (cubic-bezier arcs + rect fills), team progress bars,
 * severity risk pills, recommendation blocks and the AI verdict box.
 *
 * Text is ASCII-sanitized and every operator operand is printable ASCII, so a
 * JS string index equals a PDF byte offset — the xref table stays exact.
 *
 * `buildProjectSummaryPdf` accepts a partial `ProjectSummaryData`; anything the
 * caller omits falls back to `SAMPLE_SUMMARY`, the template's own values (see
 * `lib/reportExport.ts`, which fills them from live project data).
 */

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const LM = 40; // page margin
const CONTENT_W = PAGE_W - 2 * LM;

/** Escape ( ) \ for PDF literal strings. */
const esc = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Printable-ASCII only → one JS char == one PDF byte. */
const toAscii = (s: string): string => s.replace(/[^\x20-\x7E]/g, '-').replace(/\t/g, '    ');

/** Round to 2 decimals and emit the shortest form. */
const f = (n: number): string => String(Math.round(n * 100) / 100);

/** '#rrggbb' → PDF 'r g b' operand string. */
const rgb = (hex: string): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${f(((n >> 16) & 255) / 255)} ${f(((n >> 8) & 255) / 255)} ${f((n & 255) / 255)}`;
};

/** Rough Helvetica advance (PDF has no text metrics) for wrapping/alignment. */
const strWidth = (s: string, size: number): number => s.length * size * 0.53;

/** Wrap text into lines that fit maxWidth at the given size. */
export const wrapText = (s: string, size: number, maxWidth: number): string[] => {
  const words = toAscii(s).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (strWidth(t, size) <= maxWidth) {
      cur = t;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
};

/**
 * Truncate text so it fits `maxWidth` at the given size, appending `...` only
 * when something is actually dropped (an already-fitting string is returned
 * unchanged, so template output stays byte-identical).
 */
export const clipText = (s: string, size: number, maxWidth: number): string => {
  const text = toAscii(s);
  if (strWidth(text, size) <= maxWidth) return text;
  const ellipsis = '...';
  const room = Math.max(1, Math.floor(maxWidth / (size * 0.53)) - ellipsis.length);
  return `${text.slice(0, room)}${ellipsis}`;
};

/** Serialize the JS-side object bodies into a byte-accurate PDF blob. */
const serializePdf = (objects: string[]): Blob => {
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body) => {
    offsets.push(pdf.length);
    pdf += `${offsets.length} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
};

// ---------------------------------------------------------------------------
// Data model (matches the "AI Project Assistant — Project Summary" template)
// ---------------------------------------------------------------------------

export interface SummaryKpi {
  label: string;
  value: string;
  status?: string;
  statusColor?: string; // hex
}

export interface SummarySlice {
  label: string;
  value: number;
  color: string;
}

export interface SummaryTeamRow {
  name: string;
  pct: number;
}

export interface SummaryRisk {
  label: string;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SummaryRecommendation {
  title: string;
  body: string;
}

export interface ProjectSummaryData {
  appName: string;
  projectName: string;
  sprintLabel: string;
  badge: string;
  kpis: SummaryKpi[];
  taskStatus: SummarySlice[];
  sprintBars: SummarySlice[];
  team: SummaryTeamRow[];
  risks: SummaryRisk[];
  recommendations: SummaryRecommendation[];
  verdictTitle: string;
  verdict: string;
  footer: string;
}

/**
 * Minimal vector canvas. `*Top` coordinates are measured from the top of the
 * page; angles are degrees (0° = +x, positive = CCW in PDF's bottom-up space).
 */
class PdfDoc {
  private pages: string[][] = [];
  private cur: string[] = [];

  constructor() {
    this.newPage();
  }

  newPage(): void {
    if (this.cur.length > 0) this.pages.push(this.cur);
    this.cur = [];
  }

  private op(s: string): void {
    this.cur.push(s);
  }

  private paint(fill?: string, stroke?: string, lw?: number): void {
    if (lw !== undefined) this.op(`${f(lw)} w`);
    if (fill) this.op(`${rgb(fill)} rg`);
    if (stroke) this.op(`${rgb(stroke)} RG`);
  }

  private pt(cx: number, cy: number, r: number, deg: number): [number, number] {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  /** Cubic-bezier arc a1 → a2 (max 90° per segment, signed sweep). */
  private arcSegments(cx: number, cy: number, r: number, a1: number, a2: number): string[] {
    const sweep = a2 - a1;
    if (sweep === 0) return [];
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
    const step = sweep / steps;
    const cmds: string[] = [];
    for (let i = 0; i < steps; i++) {
      const t1 = a1 + step * i;
      const t2 = t1 + step;
      const k = (4 / 3) * Math.tan(((step * Math.PI) / 180) / 4);
      const [p0x, p0y] = this.pt(cx, cy, r, t1);
      const [p3x, p3y] = this.pt(cx, cy, r, t2);
      const kk = r * k;
      const s1 = Math.sin((t1 * Math.PI) / 180);
      const c1 = Math.cos((t1 * Math.PI) / 180);
      const s2 = Math.sin((t2 * Math.PI) / 180);
      const c2 = Math.cos((t2 * Math.PI) / 180);
      cmds.push(
        `${f(p0x - kk * s1)} ${f(p0y + kk * c1)} ${f(p3x + kk * s2)} ${f(p3y - kk * c2)} ${f(p3x)} ${f(p3y)} c`
      );
    }
    return cmds;
  }

  /** Text; yTop is the text block top (baseline ≈ yTop + size). */
  text(txt: string, x: number, yTop: number, opts: { size?: number; bold?: boolean; color?: string } = {}): void {
    const size = opts.size ?? 11;
    const face = opts.bold ? '/F2' : '/F1';
    this.paint(opts.color, undefined, undefined);
    this.op(
      `BT ${face} ${f(size)} Tf 1 0 0 1 ${f(x)} ${f(PAGE_H - (yTop + size))} Tm (${esc(toAscii(txt))}) Tj ET`
    );
  }

  /** Axis-aligned rectangle, top-left origin. */
  rect(x: number, yTop: number, w: number, h: number, fill?: string, stroke?: string, lw?: number): void {
    if (!fill && !stroke) return;
    const y = PAGE_H - (yTop + h);
    this.paint(fill, stroke, lw);
    this.op(`${f(x)} ${f(y)} ${f(w)} ${f(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  }

  /** Rounded rectangle. */
  rrect(x: number, yTop: number, w: number, h: number, rr: number, fill?: string, stroke?: string, lw?: number): void {
    if (!fill && !stroke) return;
    const bottom = PAGE_H - (yTop + h);
    const r = Math.min(rr, w / 2, h / 2);
    this.paint(fill, stroke, lw);
    const cmds: string[] = [`${f(x + r)} ${f(bottom)} m`];
    cmds.push(`${f(x + w - r)} ${f(bottom)} l`);
    cmds.push(...this.arcSegments(x + w - r, bottom + r, r, -90, 0));
    cmds.push(`${f(x + w)} ${f(bottom + h - r)} l`);
    cmds.push(...this.arcSegments(x + w - r, bottom + h - r, r, 0, 90));
    cmds.push(`${f(x + r)} ${f(bottom + h)} l`);
    cmds.push(...this.arcSegments(x + r, bottom + h - r, r, 90, 180));
    cmds.push(`${f(x)} ${f(bottom + r)} l`);
    cmds.push(...this.arcSegments(x + r, bottom + r, r, 180, 270));
    cmds.push('h');
    cmds.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.op(cmds.join('\n'));
  }

  /** Horizontal line. */
  hline(x: number, yTop: number, w: number, color: string, lw = 1): void {
    const y = PAGE_H - yTop;
    this.paint(undefined, color, lw);
    this.op(`${f(x)} ${f(y)} m ${f(x + w)} ${f(y)} l S`);
  }

  /** Annular (doughnut) wedge between two arcs + two connecting radii. */
  wedge(cx: number, cyTop: number, rOuter: number, rInner: number, a1: number, a2: number, fill: string): void {
    if (a2 <= a1 || rInner >= rOuter) return;
    const cy = PAGE_H - cyTop;
    this.paint(fill, undefined, undefined);
    const cmds: string[] = [];
    const [ox1, oy1] = this.pt(cx, cy, rOuter, a1);
    cmds.push(`${f(ox1)} ${f(oy1)} m`);
    cmds.push(...this.arcSegments(cx, cy, rOuter, a1, a2));
    const [ix2, iy2] = this.pt(cx, cy, rInner, a2);
    cmds.push(`${f(ix2)} ${f(iy2)} l`);
    cmds.push(...this.arcSegments(cx, cy, rInner, a2, a1));
    cmds.push('h');
    cmds.push('f');
    this.op(cmds.join('\n'));
  }

  /** Serialize pages into a single valid PDF blob. */
  finish(): Blob {
    if (this.cur.length > 0) this.pages.push(this.cur);
    const pageCount = this.pages.length;
    const font1Num = 3 + pageCount * 2;
    const font2Num = font1Num + 1;
    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ];
    this.pages.forEach((cmds, i) => {
      const stream = cmds.join('\n');
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << /Font << /F1 ${font1Num} 0 R /F2 ${font2Num} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`
      );
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    return serializePdf(objects);
  }
}

/** Doughnut palette, in template order: Closed, In Progress, Ready for Test, Testing, New. */
export const TASK_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#7c3aed', '#33506e'];

/**
 * Default values mirroring the "AI Project Assistant — Project Summary"
 * template. Exported so callers can merge real project data onto the template
 * and fall back to these values for any section the backend has no data for.
 */
export const SAMPLE_SUMMARY: ProjectSummaryData = {
  appName: 'AI Project Assistant',
  projectName: 'E-Commerce Platform Revamp',
  sprintLabel: 'Sprint 1',
  badge: 'Project At Risk',
  kpis: [
    { label: 'Overall Progress', value: '64%', status: 'Steady progress', statusColor: '#16a34a' },
    { label: 'Tasks Completed', value: '35 / 67', status: '52% closed', statusColor: '#6b7280' },
    { label: 'Sprint Progress', value: '72%', status: '20 / 28 tasks', statusColor: '#6b7280' },
    { label: 'Deadline Confidence', value: '78%', status: 'Monitor closely', statusColor: '#d97706' },
  ],
  taskStatus: [
    { label: 'Closed', value: 35, color: TASK_COLORS[0] },
    { label: 'In Progress', value: 12, color: TASK_COLORS[1] },
    { label: 'Ready for Test', value: 7, color: TASK_COLORS[2] },
    { label: 'Testing', value: 5, color: TASK_COLORS[3] },
    { label: 'New', value: 8, color: TASK_COLORS[4] },
  ],
  sprintBars: [
    { label: 'Completed', value: 20, color: '#4f46e5' },
    { label: 'Remaining', value: 8, color: '#f87171' },
  ],
  team: [
    { name: 'UI/UX', pct: 88 },
    { name: 'Frontend', pct: 73 },
    { name: 'Backend', pct: 67 },
    { name: 'QA', pct: 67 },
  ],
  risks: [
    { label: 'Payment Gateway Integration', level: 'HIGH' },
    { label: 'Payment Flow Testing', level: 'HIGH' },
    { label: 'Order API Optimization', level: 'MEDIUM' },
    { label: 'Checkout Validation', level: 'MEDIUM' },
  ],
  recommendations: [
    {
      title: '01. Resolve Critical Tasks',
      body: 'Prioritize payment integration and other blocked backend tasks.',
    },
    {
      title: '02. Clear QA Bottleneck',
      body: 'Move ready-for-test tasks through QA as quickly as possible.',
    },
    {
      title: '03. Control Scope',
      body: 'Avoid adding non-critical work until current sprint tasks are completed.',
    },
  ],
  verdictTitle: 'AI Verdict',
  verdict:
    'Project is progressing steadily, but critical backend and QA tasks require immediate attention to protect the deadline. Current velocity indicates a 78% confidence of meeting the planned deadline.',
  footer:
    'Generated by AI Project Assistant - Project Plan - Sprint Data - Task Data - Development Activity',
};

const RISK_COLORS: Record<SummaryRisk['level'], { fg: string; bg: string }> = {
  HIGH: { fg: '#dc2626', bg: '#fee2e2' },
  MEDIUM: { fg: '#d97706', bg: '#fef3c7' },
  LOW: { fg: '#16a34a', bg: '#dcfce7' },
};

/**
 * Build the styled "AI Project Assistant — Project Summary" report as a Blob.
 * Pass only the fields you want to override; anything missing falls back to the
 * bundled sample values so the PDF is always complete.
 */
export function buildProjectSummaryPdf(overrides: Partial<ProjectSummaryData> = {}): Blob {
  const d: ProjectSummaryData = { ...SAMPLE_SUMMARY, ...overrides };
  const doc = new PdfDoc();
  const PAGE_BOTTOM = 756; // content limit — footer hairline sits at PAGE_H - 38
  let y = 44;

  /** Start a fresh page when the next block would overflow the content area. */
  const guard = (h: number): void => {
    if (y + h > PAGE_BOTTOM) {
      doc.newPage();
      y = 40;
    }
  };

  // 1. Header ---------------------------------------------------------------
  guard(64);
  doc.text(d.appName, LM, y, { size: 22, bold: true, color: '#172033' });
  const badgeText = d.badge;
  const badgeW = strWidth(badgeText, 11) + 24;
  // "<project> - <type> - <period>", kept clear of the top-right badge.
  doc.text(
    clipText([d.projectName, d.sprintLabel].filter(Boolean).join(' - '), 12, PAGE_W - 2 * LM - badgeW - 14),
    LM,
    y + 24,
    { size: 12, color: '#6b7280' }
  );
  doc.rrect(PAGE_W - LM - badgeW, y - 4, badgeW, 26, 13, '#fff4d6', '#e6c688', 1.2);
  doc.text(badgeText, PAGE_W - LM - badgeW + (badgeW - strWidth(badgeText, 11)) / 2, y + 1, {
    size: 11,
    bold: true,
    color: '#9a6700',
  });
  y += 58;

  // 2. KPI cards ------------------------------------------------------------
  guard(80);
  const cardGap = 15;
  const kpiCardH = 66;
  const kpiW = (CONTENT_W - cardGap * 3) / 4;
  d.kpis.slice(0, 4).forEach((kpi, i) => {
    const x = LM + i * (kpiW + cardGap);
    doc.rrect(x, y, kpiW, kpiCardH, 8, '#ffffff', '#d8dee9', 1);
    doc.text(kpi.label, x + 12, y + 10, { size: 10, color: '#6b7280' });
    doc.text(clipText(kpi.value, 22, kpiW - 24), x + 12, y + 30, { size: 22, bold: true, color: '#111827' });
    if (kpi.status) {
      doc.text(kpi.status, x + 12, y + 52, { size: 9.5, color: kpi.statusColor || '#6b7280' });
    }
  });
  y += kpiCardH + 12;

  // 3. Charts — task-status doughnut + sprint bar chart ----------------------
  guard(190);
  const chartCardH = 168;
  const leftW = 318;
  const rightW = CONTENT_W - leftW - 12;

  doc.rrect(LM, y, leftW, chartCardH, 8, '#ffffff', '#d8dee9', 1);
  doc.text('Task Status Distribution', LM + 12, y + 10, { size: 11.5, bold: true, color: '#172033' });

  // Cap at the five template buckets so the legend always fits the card.
  const slices = d.taskStatus.slice(0, 5);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const dcx = LM + 96;
  const dcy = y + 96;
  const rO = 51;
  const rI = 27;
  let a = 90;
  slices.forEach((s) => {
    const sweep = (s.value / Math.max(1, total)) * 360;
    doc.wedge(dcx, dcy, rO, rI, a, a + sweep, s.color);
    a += sweep;
  });
  doc.text(String(total), dcx - 16, dcy - 17, { size: 15, bold: true, color: '#111827' });
  doc.text('tasks', dcx - 2, dcy + 3, { size: 9, color: '#6b7280' });

  let ly = dcy - rO + 2;
  slices.forEach((s) => {
    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
    doc.rect(LM + leftW - 172, ly, 9, 9, s.color);
    doc.text(clipText(s.label, 9.5, 100), LM + leftW - 154, ly - 2, { size: 9.5, color: '#334155' });
    doc.text(`${pct}%`, LM + leftW - 46, ly - 2, { size: 9.5, bold: true, color: '#111827' });
    ly += 17;
  });

  const rx0 = LM + leftW + 12;
  doc.rrect(rx0, y, rightW, chartCardH, 8, '#ffffff', '#d8dee9', 1);
  doc.text('Sprint Performance', rx0 + 12, y + 10, { size: 11.5, bold: true, color: '#172033' });

  let lx = rx0 + 14;
  d.sprintBars.forEach((b) => {
    doc.rect(lx, y + 28, 8, 8, b.color);
    doc.text(b.label, lx + 12, y + 25, { size: 8.5, color: '#334155' });
    lx += 12 + strWidth(b.label, 8.5) + 18;
  });

  const plotX = rx0 + 16;
  const plotW = rightW - 32;
  const plotTop = y + 44;
  const plotH = 96;
  const maxV = Math.max(...d.sprintBars.map((b) => b.value), 1);
  [0, 0.5, 1].forEach((frac) => {
    const gy = plotTop + plotH - frac * plotH;
    doc.hline(plotX, gy, plotW, '#e9edf4', 0.8);
    doc.text(String(Math.round(maxV * frac)), plotX - 20, gy - 5, { size: 8, color: '#9ca3af' });
  });

  const barW = 30;
  const barGap = 34;
  const nBars = d.sprintBars.length;
  const totalW = nBars * (barW + barGap) - barGap;
  const bx = plotX + (plotW - totalW) / 2;
  d.sprintBars.forEach((b, i) => {
    const bh = (b.value / maxV) * (plotH - 4);
    const bxx = bx + i * (barW + barGap);
    doc.rect(bxx, plotTop + plotH - 2 - bh, barW, bh, b.color);
    doc.text(String(b.value), bxx + barW / 2 - 5, plotTop + plotH - bh - 18, {
      size: 9,
      bold: true,
      color: '#172033',
    });
  });
  y += chartCardH + 14;

// 4. Team performance + AI risk detection ----------------------------------
  guard(190);
  const rowCardH = 160;
  const halfW = (CONTENT_W - 12) / 2;

  doc.rrect(LM, y, halfW, rowCardH, 8, '#ffffff', '#d8dee9', 1);
  doc.text('Team Performance', LM + 12, y + 10, { size: 11.5, bold: true, color: '#172033' });
  let ty = y + 40;
  d.team.slice(0, 4).forEach((row) => {
    doc.text(clipText(row.name, 10, 200), LM + 14, ty, { size: 10, bold: true, color: '#111827' });
    const pctText = `${row.pct}%`;
    doc.text(pctText, LM + halfW - 18 - strWidth(pctText, 10), ty, {
      size: 10,
      bold: true,
      color: '#111827',
    });
    doc.rrect(LM + 14, ty + 11, halfW - 28, 9, 4.5, '#e9edf4');
    doc.rrect(LM + 14, ty + 11, Math.max(3, (row.pct / 100) * (halfW - 28)), 9, 4.5, '#4f46e5');
    ty += 30;
  });

  const rx2 = LM + halfW + 12;
  doc.rrect(rx2, y, halfW, rowCardH, 8, '#ffffff', '#d8dee9', 1);
  doc.text('AI Risk Detection', rx2 + 12, y + 10, { size: 11.5, bold: true, color: '#172033' });
  let ry = y + 34;
  d.risks.slice(0, 4).forEach((r) => {
    const pill = r.level;
    const pw = strWidth(pill, 9) + 14;
    doc.rrect(rx2 + 8, ry - 7, halfW - 16, 26, 6, '#f8fafc');
    // Keep the label clear of the severity pill on the right of the row.
    doc.text(clipText(r.label, 9.5, halfW - 16 - pw - 26), rx2 + 18, ry + 1, {
      size: 9.5,
      color: '#334155',
    });
    const c = RISK_COLORS[r.level];
    doc.rrect(rx2 + halfW - 16 - pw, ry - 4, pw, 16, 8, c.bg);
    doc.text(pill, rx2 + halfW - 16 - pw + (pw - strWidth(pill, 9)) / 2, ry + 2, {
      size: 9,
      bold: true,
      color: c.fg,
    });
    ry += 31;
  });
  y += rowCardH + 14;

  // 5. AI recommended actions -----------------------------------------------
  guard(120);
  doc.text('AI Recommended Actions', LM, y, { size: 14, bold: true, color: '#172033' });
  y += 26;
  const recH = 84;
  const recGap = 10;
  const recW = (CONTENT_W - recGap * 2) / 3;
  d.recommendations.slice(0, 3).forEach((rec, i) => {
    const x = LM + i * (recW + recGap);
    doc.rrect(x, y, recW, recH, 8, '#f8fafc');
    doc.text(clipText(rec.title, 10, recW - 24), x + 12, y + 12, {
      size: 10,
      bold: true,
      color: '#172033',
    });
    const lines = wrapText(rec.body, 9, recW - 24);
    lines.slice(0, 4).forEach((ln, j) => doc.text(ln, x + 12, y + 32 + j * 13, { size: 9, color: '#475569' }));
  });
  y += recH + 14;

  // 6. AI verdict ------------------------------------------------------------
  // The box stays 78pt tall for the template's three-line verdict and only
  // grows when a real AI summary needs more room — text is never silently cut.
  const verdictLines = wrapText(d.verdict, 10, CONTENT_W - 32).slice(0, 8);
  const verdictH = Math.max(78, 30 + verdictLines.length * 13);
  guard(verdictH + 12);
  doc.rrect(LM, y, CONTENT_W, verdictH, 8, '#eef2ff');
  doc.rect(LM, y, 4, verdictH, '#4f46e5');
  doc.text(d.verdictTitle, LM + 16, y + 12, { size: 11, bold: true, color: '#172033' });
  verdictLines.forEach((ln, j) => doc.text(ln, LM + 16, y + 28 + j * 13, { size: 10, color: '#334155' }));
  y += verdictH;

  // 7. Footer ----------------------------------------------------------------
  const footY = PAGE_H - 26;
  doc.hline(LM, footY - 12, CONTENT_W, '#e5e7eb', 0.8);
  doc.text(d.footer, (PAGE_W - strWidth(d.footer, 9)) / 2, footY - 2, { size: 9, color: '#9ca3af' });

  return doc.finish();
}