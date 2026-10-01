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

/**
 * Unwrap a backend envelope. The backend may return the raw payload directly,
 * or wrap it under `dataset` or `response.dataset`. This helper normalises the
 * shape so callers can work with the inner object/array.
 */
export function unwrap<T>(response: any): T {
  const dataset = response?.data?.response?.dataset
    ?? response?.response?.dataset
    ?? response?.dataset
    ?? response;
  if (dataset && typeof dataset === 'object' && 'enc_data' in dataset) {
    throw new Error('Encrypted API data must be decoded by the configured API client.');
  }
  return dataset as T;
}
