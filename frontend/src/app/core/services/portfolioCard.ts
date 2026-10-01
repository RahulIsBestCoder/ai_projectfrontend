import type {
  AiDashboardCard,
  PortfolioCompletionForecast,
  PortfolioProjectCard,
  PortfolioProjectHealth,
  PortfolioProjectRow,
} from './portfolio';

import type { ManualCompletion } from './manualCompletion';

/** Data a Portfolio card hands to Overview when "Open" is clicked, so Overview renders instantly. */
export interface ProjectOpenSnapshot {
  card: PortfolioProjectCard;
  ai: AiDashboardCard | null;
}

/** 0-100 delay implied by a stored risk level. Used when the forecast has no
 *  modelled `on_time_probability` (too little delivery history). Mirrors
 *  `LEVEL_TO_DELAY_RISK` in `lib/api/risk.ts` so every screen agrees. */
const RISK_LEVEL_TO_DELAY: Record<string, number> = { CRITICAL: 88, HIGH: 66, MEDIUM: 42, LOW: 18 };

export const deliveryStatus = (
  health: PortfolioProjectHealth | null,
  forecast: PortfolioCompletionForecast | null,
): PortfolioProjectCard['deliveryStatus'] => {
  const probability = forecast?.forecast?.onTimeProbability;
  const risk = health?.risk?.latest?.level?.toUpperCase();
  if (risk === 'CRITICAL' || (probability != null && probability < 0.2)) return 'off_track';
  if (risk === 'HIGH' || (probability != null && probability < 0.8)) return 'at_risk';
  if (probability != null || health?.overall?.score != null) return 'on_track';
  return 'unknown';
};

/**
 * Delay % for the card. The backend never sends `forecast.on_time_probability`
 * today (`on_time_probability: null` on the stored prediction), so a modelled
 * number is preferred and the stored risk level is the documented fallback —
 * otherwise the card showed a permanent dash on every project.
 */
const delayPercentFrom = (
  health: PortfolioProjectHealth | null,
  forecast: PortfolioCompletionForecast | null,
): number | null => {
  const onTime = forecast?.forecast?.onTimeProbability;
  if (onTime != null) return Math.round((1 - Math.max(0, Math.min(1, onTime))) * 100);
  const level = health?.risk?.latest?.level?.toUpperCase();
  return level && RISK_LEVEL_TO_DELAY[level] != null ? RISK_LEVEL_TO_DELAY[level] : null;
};


export const baseCard = (project: PortfolioProjectRow): PortfolioProjectCard => ({
  id: project.id,
  name: project.name,
  description: project.description || '',
  healthScore: null,
  healthStatus: 'unknown',
  healthTrend: 'unknown',
  deliveryStatus: 'unknown',
  openRisks: 0,
  delayPercent: null,
  predictedCompletionDate: null,
  remainingStoryPoints: null,
  forecastConfidence: null,
  forecastStatus: null,
  healthUnavailable: true,
  forecastUnavailable: true,
});

export const hydrateCard = (
  current: PortfolioProjectCard,
  health: PortfolioProjectHealth | null,
  forecast: PortfolioCompletionForecast | null,
): PortfolioProjectCard => {
  return {
    ...current,
    healthScore: health?.overall?.score ?? null,
    healthStatus: health?.overall?.status || 'unknown',
    healthTrend: health?.overall?.trend || 'unknown',
    deliveryStatus: deliveryStatus(health, forecast),
    openRisks: Object.values(health?.risk?.counts ?? {}).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    ),
    delayPercent: delayPercentFrom(health, forecast),
    predictedCompletionDate: forecast?.forecast?.p50 ?? null,
    remainingStoryPoints: forecast?.remainingStoryPoints ?? null,
    forecastConfidence: forecast?.confidence ?? null,
    forecastStatus: forecast?.forecast?.status ?? null,
    healthUnavailable: health === null,
    forecastUnavailable: forecast === null,
  };
};

export const pctText = (value: number | null | undefined) => (value == null ? '—' : `${Math.round(value)}%`);

/** Reports store the deadline probability as a 0–1 fraction; older ones used 0–100. */
export const probabilityPercent = (value: number | null | undefined) =>
  value == null ? null : value <= 1 ? value * 100 : value;

/** `{ notImplemented: 2, partial: 1 }` → "not implemented 2 · partial 1". */
export const countsText = (counts: Record<string, number>) =>
  Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${count}`)
    .join(' · ') || '—';

/** Report list items are strings or objects (risks, recommendations); pick readable text. */
export const itemText = (item: unknown): string => {
  if (typeof item === 'string') return item;
  const obj = item as Record<string, unknown> | null;
  const text = obj?.title ?? obj?.summary ?? obj?.issue ?? obj?.description ?? obj?.text ?? obj?.recommendation;
  return typeof text === 'string' ? text : '';
};
