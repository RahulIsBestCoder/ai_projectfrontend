/**
 * Minimal, dependency-free PDF generator (PDF 1.4, Helvetica, US Letter).
 *
 * The backend has no report-export route (`/reports/:id/export/:fmt` is 404),
 * so the Reports view falls back to generating a real PDF in the browser when
 * a report has no `artifact_url`. Only standard PDF text operators are used:
 * `BT/ET` text blocks, `Tm` positioning, `Tj` show-text and `T*` line advance.
 *
 * All content is sanitized to printable ASCII so that one JS character always
 * equals one PDF byte — that keeps the xref byte offsets exact when building
 * the file as a single string.
 */

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 72;
const LEADING = 16; // baseline-to-baseline for body text
const TITLE_FONT_SIZE = 18;
const BODY_FONT_SIZE = 11;

/** Escape ( ) \ for PDF literal strings. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Keep only printable ASCII so string length === byte length (xref offsets stay exact). */
function toAscii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '-').replace(/\t/g, '    ');
}

/** Number of body lines that fit under the title on one page. */
function linesPerPage(): number {
  return Math.max(1, Math.floor((PAGE_H - 2 * MARGIN - 50) / LEADING));
}

/**
 * Build a valid multi-page PDF from a title and plain-text lines.
 * Empty lines render as blank lines (page flow is preserved).
 */
export function buildSimplePdf(title: string, lines: string[]): Blob {
  // Chunk lines into pages
  const perPage = linesPerPage();
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);

  // Object layout: 1 = Catalog, 2 = Pages, then per page [Page, Contents],
  // last = Font. /Kids and /Contents references depend on that numbering.
  const fontObjNum = 3 + pages.length * 2;
  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );

  const safeTitle = toAscii(title);
  pages.forEach((pageLines, i) => {
    let stream = '';
    // Title block
    stream += `BT /F1 ${TITLE_FONT_SIZE} Tf 0 g 1 0 0 1 ${MARGIN} ${PAGE_H - MARGIN - TITLE_FONT_SIZE} Tm (${esc(safeTitle)}) Tj ET\n`;
    // Body block — T* advances by TL after each Tj
    stream += `BT /F1 ${BODY_FONT_SIZE} Tf ${LEADING} TL 0 g 1 0 0 1 ${MARGIN} ${PAGE_H - MARGIN - 50} Tm\n`;
    pageLines.forEach((ln) => {
      stream += `(${esc(toAscii(ln))}) Tj T*\n`;
    });
    stream += 'ET';
    const contentNum = 4 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  // Serialize with byte-accurate xref offsets
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

/** Trigger a client-side file download for a blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filesystem-safe basename for download filenames. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  );
}
