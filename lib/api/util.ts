import { fromApi } from './case';

/**
 * Unwrap a list response. The backend returns either a bare array or the
 * paginated envelope `{ rows, count, page, limit, total_pages }` (§2).
 */
export function rowsOf<T = any>(data: any): T[] {
  const d = fromApi(data);
  if (Array.isArray(d)) return d as T[];
  if (d && Array.isArray(d.rows)) return d.rows as T[];
  return [];
}

/**
 * Unwrap a single-resource read. The backend sometimes replies `dataset: []` or
 * `dataset: {}` to mean "no record" (with `action_status: true`). Normalise that
 * to `null`; take the first element of a non-empty array.
 */
export function oneOf<T = any>(data: any): T | null {
  const d = fromApi(data);
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? (d[0] as T) : null;
  if (typeof d === 'object' && Object.keys(d).length === 0) return null;
  return d as T;
}

/** Run a read; on any failure log and return the fallback (empty state), never demo data. */
export async function safeRead<T>(fn: () => Promise<T>, fallback: T, label = 'api'): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (typeof console !== 'undefined') {
      console.warn(`[${label}] read failed:`, err?.msg || err?.message || err);
    }
    return fallback;
  }
}
