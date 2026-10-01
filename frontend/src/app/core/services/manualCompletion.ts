/** Local manual completion fallback — a manager-entered % per project. */
export type ManualCompletion = { value: number; updatedAt: string; note?: string };

/**
 * Per-project manual completion % (local fallback).
 *
 * Phoenix Cloud / Nova Engine / Zenith Dashboard have health + forecast rows
 * but no AI report and no scored sprint, so the completion donut would show
 * "No completion data yet" forever. The backend exposes no route to write an
 * AI-report/sprint result, so a manager-entered % lives in localStorage until
 * real evidence (AI report → sprint completion) replaces it. Seeded once with
 * sensible starting values; editing any card overwrites its seed.
 */
const key = (projectId: string) => `aipi_completion:${projectId}`;

const MANUAL_SEEDS: { match: string; value: number }[] = [
  { match: 'phoenix cloud', value: 62 },
  { match: 'nova engine', value: 74 },
  { match: 'zenith dashboard', value: 48 },
];

export function getManualCompletion(projectId: string): ManualCompletion | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.value === 'number') return parsed as ManualCompletion;
    }
  } catch { /* corrupted entry — fall through to seed lookup */ }
  return null;
}

export function getManualCompletions(ids: string[], names?: Map<string, string>): Record<string, ManualCompletion> {
  const out: Record<string, ManualCompletion> = {};
  for (const id of ids) {
    const existing = getManualCompletion(id);
    if (existing) {
      out[id] = existing;
      continue;
    }
    // One-time seed for the three backend-less demo projects (matched by name
    // so it survives id changes); any manual edit replaces the seed forever.
    const name = (names?.get(id) || '').toLowerCase();
    const seed = MANUAL_SEEDS.find((s) => name.includes(s.match));
    if (seed) {
      const entry: ManualCompletion = { value: seed.value, updatedAt: new Date(0).toISOString(), note: 'seed' };
      try { localStorage.setItem(key(id), JSON.stringify(entry)); } catch { /* non-fatal */ }
      out[id] = entry;
    }
  }
  return out;
}

export function saveManualCompletion(projectId: string, value: number): ManualCompletion {
  const entry: ManualCompletion = { value: Math.max(0, Math.min(100, Math.round(value))), updatedAt: new Date().toISOString() };
  try { localStorage.setItem(key(projectId), JSON.stringify(entry)); } catch { /* non-fatal */ }
  return entry;
}

export function clearManualCompletion(projectId: string): void {
  try { localStorage.removeItem(key(projectId)); } catch { /* non-fatal */ }
}
