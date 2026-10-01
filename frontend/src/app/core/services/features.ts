import { http } from '@core/http/http';
import { rowsOf } from '@core/http/util';
import { FeatureFlag, FeatureFlagsResult } from '@shared/models';

/**
 * Best-effort read of the backend feature-flag registry.
 *
 * `GET /v1/feature-flags` is NOT mounted by the current backend revision
 * (see backend/src/app_routing.ts — the express app only wires user /
 * organizations / integrations / git_intelligence / projects / work-items /
 * sprints / analytics / risk-predictions / ai / reports / notifications /
 * plans / departments). So this resolves to `{ source: 'none' }` and the
 * Settings tab renders the platform flags derived from the live
 * `GET /v1/ai/providers` catalog + runtime env instead. When the backend
 * ships the route, the same call lights the panel up with no frontend change.
 */
export async function getFeatureFlags(): Promise<FeatureFlagsResult> {
  try {
    const res = await http.get('/feature-flags');
    const raw = rowsOf<any>(res.data);
    if (!Array.isArray(raw) || raw.length === 0) {
      // Backend replied with an empty registry (or a non-list payload).
      return { flags: [], source: 'none' };
    }
    const flags: FeatureFlag[] = [];
    for (const f of raw) {
      if (typeof f === 'string') {
        flags.push({ key: f, value: true, source: 'backend' });
        continue;
      }
      const key = String(f.key || f.name || f.flag || '').trim();
      if (!key) continue;
      const value = f.value ?? f.enabled ?? f.active ?? f.status ?? true;
      flags.push({
        key,
        value: typeof value === 'boolean' || typeof value === 'number' ? value : String(value),
        source: 'backend',
        description: f.description || f.title || undefined,
      });
    }
    return { flags, source: flags.length ? 'backend' : 'none' };
  } catch (err: any) {
    return { flags: [], source: 'none', error: err?.msg || String(err?.message || err) };
  }
}