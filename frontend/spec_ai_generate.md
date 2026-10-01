# Portfolio dashboard UI integration

## Purpose

Build the portfolio dashboard and its project tabs from stored backend data.
Each project health/assessment tab must include an explicit **AI Generate**
button. The button is the only UI action that synchronizes source systems, runs
the combined AI assessment, persists the result, and refreshes the displayed
health, risk, and deadline data.

## AI Generate button

### Placement and appearance

Add the button inside the project assessment/health tab header, aligned to the
right of the tab title:

```text
+--------------------------------------------------------------+
| Project Health & Delivery                 [AI Generate ✦]     |
+--------------------------------------------------------------+
| Overall health | Progress | Quality | Forecast | Risks        |
+--------------------------------------------------------------+
```

Button requirements:

- Label: `AI Generate`.
- Use a colorful AI gradient rather than the dashboard's standard blue-only
  button style. Suggested gradient: violet `#6D4AFF` to magenta `#D946EF` with
  white text.
- Add an AI/sparkles icon and an accessible label such as
  `Generate project analysis with AI`.
- Keep the button disabled while its request is running to prevent duplicate
  analysis records.
- While running, show a spinner and change the label to `Analyzing…`.
- On success, replace all tab cards from the POST response without requiring a
  page reload and show `Analysis updated` with the returned assessment time.
- On failure, keep the previous cards visible and show the backend error message
  with a `Retry` action.

### Endpoint integration

```http
POST /v1/projects/:projectId/ai-assessment/refresh
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sync": true,
  "provider": "ollama",
  "model": "model-selected-in-the-UI"
}
```

Build the URL with the currently selected project ID. Never hard-code the MGROC
ID in the reusable component. Send the provider and exact model selected in the
AI provider controls; do not substitute an environment-default model in the UI.

Use `sync: true` for the normal **AI Generate** action. The backend then:

1. Synchronizes every active Git integration using its saved branch.
2. Synchronizes the project's Taiga integration.
3. Reads project requirements, accepted-plan data, Git activity, synchronized
   frontend/backend source snapshots, Taiga work items, sprints, and developers.
4. Runs the selected AI provider/model across the combined project evidence.
5. Saves health and quality snapshots, risks, deadline prediction, and combined
   project context.
6. Returns all data required to redraw the tab.

Use `sync: false` only for a deliberate **Analyze saved data** action. It avoids
external synchronization and analyzes the latest database snapshot.

### Response contract

```ts
export interface AiAssessmentRefreshDataset {
  project_id: string;
  source_sync: {
    status?: 'success' | 'partial' | 'failed';
    integrations_synced?: number;
    items_synced?: number;
    results?: Array<{
      integration_id: string;
      provider: string;
      category: string;
      status: 'success' | 'partial' | 'failed';
      items_synced: number;
      derived_data_refreshed?: boolean;
      error?: string | null;
    }>;
  } | null;
  assessment: {
    health: number | null;
    quality: number | null;
    confidence_percent: number;
    summary: string;
    limitations: string[];
    evidence: string[];
    sources: string[];
    assessed_at: string;
  };
  health: ProjectHealth;
  completion_forecast: CompletionForecast;
  risks: unknown;
  deadline_prediction: unknown;
  context_updated: boolean;
}
```

The actual payload is wrapped in `ApiEnvelope<AiAssessmentRefreshDataset>`.
Treat the operation as successful only when both HTTP status is successful and
`response.status.action_status === true`.

### Angular service method

Add this method to `PortfolioDashboardService`:

```ts
export type AiProvider = 'gemini' | 'grok' | 'ollama';

refreshAiAssessment(
  projectId: string,
  provider: AiProvider,
  model: string,
  sync = true,
) {
  return this.http.post<ApiEnvelope<AiAssessmentRefreshDataset>>(
    `/v1/projects/${encodeURIComponent(projectId)}/ai-assessment/refresh`,
    { sync, provider, model },
  ).pipe(this.dataset());
}
```

The existing authentication interceptor should add the bearer token. If the UI
does not have one, pass `Authorization: Bearer <access_token>` explicitly.

### Component action

```ts
aiGenerating = false;
aiGenerateError: string | null = null;

generateAiAssessment(): void {
  if (this.aiGenerating || !this.projectId) return;

  this.aiGenerating = true;
  this.aiGenerateError = null;

  this.dashboardService.refreshAiAssessment(
    this.projectId,
    this.selectedProvider,
    this.selectedModel,
    true,
  ).pipe(finalize(() => this.aiGenerating = false))
    .subscribe({
      next: data => {
        this.assessment = data.assessment;
        this.health = data.health;
        this.forecast = data.completion_forecast;
        this.risks = data.risks;
        this.deadlinePrediction = data.deadline_prediction;
        this.rebuildProjectCardsAndPortfolioTotals();
      },
      error: error => {
        this.aiGenerateError =
          error?.error?.response?.status?.msg ||
          error?.message ||
          'AI analysis could not be generated.';
      },
    });
}
```

Do not immediately call the health and forecast GET endpoints after this POST;
the successful response already includes their updated datasets. The regular GET
endpoints remain useful when reopening the tab later.

## Sync freshness

Git and Taiga sync now await a project-wide derived-data refresh: analytics
snapshots (progress, velocity, Git counts), deterministic risks, deadline
prediction, then combined AI project context. Counts include all repositories
saved for the project. Taiga sync also corrects story point values and sprint
delivered points. Existing incorrect values are corrected on the next Taiga sync.

Check `dataset.status` and `dataset.derived_data_refreshed` on integration sync.
`partial` with `derived_data_refreshed: false` means source import succeeded but
the refresh failed; show the warning and offer retry. Project sync exposes these
results per integration. Refetch dashboard endpoints after sync finishes.

Missing evidence remains `null`, not zero. Health/quality scores are not invented
from commit counts. An unestimated backlog or missing sprint history is not proof
of completion. Stored reports and accepted plans remain historical documents;
generate a new report to incorporate refreshed data. Projects expose
`data_refreshed_at` and `report_data_changed_at` after metric/prediction refresh.

## Dashboard composition

This screen shows one organization portfolio with summary KPIs and one card per
project. The backend does not currently expose a single portfolio endpoint, so
the UI composes the view from organization, project, health, and completion
forecast endpoints.

Do not use `project_context` for dashboard metrics. It is a compact AI prompt
context and is not the source of truth for health, risks, progress, or delivery
forecast values.

## API envelope

```ts
export interface ApiEnvelope<T> {
  response: {
    dataset: T;
    status: { msg: string; action_status: boolean };
    publish: { version: string; developer: string };
  };
}
```

Check `response.status.action_status` for every request, including HTTP 200
responses.

## Required endpoints

### Organization heading

```http
GET /v1/organizations/:organizationId
```

Use `response.dataset.name` for the organization title.

### Project list

```http
GET /v1/projects?organization_id=:organizationId&page=1&limit=100
```

Response dataset:

```ts
export interface ProjectListDataset {
  rows: ProjectRow[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  total: number;
}

export interface ProjectRow {
  _id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: string | number;
  health_score?: number | null;
}
```

Use `dataset.total` for the project count. Do not derive it from the current
page length when pagination is enabled.

### Project health and risks

Call once for each visible project:

```http
GET /v1/projects/:projectId/health
```

Relevant response contract:

```ts
export interface ProjectHealth {
  project: { _id: string; name: string; health_score?: number | null };
  overall: {
    score: number | null;
    status: string;
    trend: string;
  };
  dimensions: Array<{
    metric: string;
    label: string;
    value: number | null;
    week_avg: number | null;
    delta_7d: number | null;
    trend: string;
    status: string;
  }>;
  risk: {
    latest: {
      level: string;
      summary: string;
      factors: string[];
      confidence_score: number;
      created_at: string;
    } | null;
    counts: Record<string, number>;
  };
  computed_at: string;
}
```

### Completion and delay forecast

Call once for each visible project:

```http
GET /v1/projects/:projectId/predictions/completion
```

Relevant response fields:

```ts
export interface CompletionForecast {
  confidence?: 'high' | 'medium' | 'low';
  remaining_story_points?: number | null;
  velocity?: {
    average?: number | null;
    std_dev?: number | null;
    sprints_observed?: number;
  };
  forecast?: {
    status?: 'complete' | 'insufficient_data' | 'simulated';
    on_time_probability?: number | null;
    p50?: string | null;
    p80?: string | null;
    p95?: string | null;
    optimistic?: string | null;
  };
}
```

`on_time_probability` is a decimal between `0` and `1`, not a percentage.
Never display a missing forecast as `0% delay`.

## View model

Normalize all endpoint responses into one UI-only view model:

```ts
export interface PortfolioDashboard {
  organizationId: string;
  organizationName: string;
  totalProjects: number;
  averageHealth: number | null;
  openRiskFactors: number;
  projectsAtRisk: number;
  projects: PortfolioProjectCard[];
}

export interface PortfolioProjectCard {
  id: string;
  name: string;
  description: string;
  healthScore: number | null;
  healthStatus: string;
  healthTrend: string;
  deliveryStatus: 'on_track' | 'at_risk' | 'off_track' | 'unknown';
  openRisks: number;
  delayPercent: number | null;
  predictedCompletionDate: string | null;
  remainingStoryPoints: number | null;
  forecastConfidence: string | null;
  healthUnavailable: boolean;
  forecastUnavailable: boolean;
}
```

## Field mapping

| UI element | Source |
| --- | --- |
| Organization name | `GET /organizations/:id` → `dataset.name` |
| Project count | project list → `dataset.total` |
| Project name | project list row → `name` |
| Description | project list row → `description` |
| Health ring | health → `overall.score` |
| Health trend | health → `overall.trend` |
| Open risks | sum of health → `risk.counts` |
| Predicted completion | forecast → `forecast.p50` |
| Delay percentage | `(1 - forecast.on_time_probability) * 100` |
| Remaining scope | forecast → `remaining_story_points` |
| Forecast confidence | forecast → `confidence` |

Delivery status mapping:

```ts
function deliveryStatus(
  health: ProjectHealth | null,
  forecast: CompletionForecast | null,
): PortfolioProjectCard['deliveryStatus'] {
  const probability = forecast?.forecast?.on_time_probability;
  const risk = health?.risk.latest?.level?.toUpperCase();

  if (risk === 'CRITICAL' || probability != null && probability < 0.2) {
    return 'off_track';
  }
  if (risk === 'HIGH' || probability != null && probability < 0.8) {
    return 'at_risk';
  }
  if (probability != null || health?.overall.score != null) {
    return 'on_track';
  }
  return 'unknown';
}
```

## Portfolio calculations

Only include non-null health scores in the average:

```ts
const validHealth = cards
  .map(card => card.healthScore)
  .filter((score): score is number => score != null);

const averageHealth = validHealth.length
  ? Math.round(validHealth.reduce((sum, score) => sum + score, 0) / validHealth.length)
  : null;

const openRiskFactors = cards.reduce((sum, card) => sum + card.openRisks, 0);
const projectsAtRisk = cards.filter(card =>
  card.deliveryStatus === 'at_risk' || card.deliveryStatus === 'off_track'
).length;
```

Project-card calculations:

```ts
const riskCounts = health?.risk.counts ?? {};
const openRisks = Object.values(riskCounts)
  .reduce((sum, count) => sum + Number(count || 0), 0);

const onTime = forecast?.forecast?.on_time_probability;
const delayPercent = onTime == null
  ? null
  : Math.round((1 - Math.max(0, Math.min(1, onTime))) * 100);
```

## Angular service example

```ts
@Injectable({ providedIn: 'root' })
export class PortfolioDashboardService {
  constructor(private readonly http: HttpClient) {}

  private dataset<T>() {
    return map((envelope: ApiEnvelope<T>) => {
      if (!envelope.response.status.action_status) {
        throw new Error(envelope.response.status.msg || 'Request failed.');
      }
      return envelope.response.dataset;
    });
  }

  getOrganization(id: string) {
    return this.http.get<ApiEnvelope<{ _id: string; name: string }>>(
      `/v1/organizations/${id}`
    ).pipe(this.dataset());
  }

  getProjects(organizationId: string) {
    return this.http.get<ApiEnvelope<ProjectListDataset>>('/v1/projects', {
      params: { organization_id: organizationId, page: 1, limit: 100 },
    }).pipe(this.dataset());
  }

  getHealth(projectId: string) {
    return this.http.get<ApiEnvelope<ProjectHealth>>(
      `/v1/projects/${projectId}/health`
    ).pipe(this.dataset());
  }

  getForecast(projectId: string) {
    return this.http.get<ApiEnvelope<CompletionForecast>>(
      `/v1/projects/${projectId}/predictions/completion`
    ).pipe(this.dataset());
  }
}
```

## Screen loading sequence

1. Read the selected `organizationId`.
2. Load organization and project list in parallel.
3. Render project names and descriptions immediately.
4. For each visible project, load health and forecast in parallel.
5. Update each card independently as its data arrives.
6. Recalculate portfolio KPIs from successfully loaded cards.

Limit project-detail request concurrency to approximately four to six projects
at a time. This avoids sending hundreds of requests simultaneously when the
portfolio grows.

## Refresh behavior

The dashboard GET endpoints read stored metrics. The **15-min sync** action must
be explicit because it mutates integrations and can take time:

```http
POST /v1/projects/:projectId/sync
Authorization: Bearer <access_token>
Content-Type: application/json

{}
```

After synchronization completes, reload that project's health and forecast.
Do not repeatedly call sync from polling or component initialization.

To generate and save a fresh deadline prediction, use the explicit action:

```http
POST /v1/projects/:projectId/predictions/deadline
Authorization: Bearer <access_token>
```

Then reload project health and predictions. The ordinary portfolio page should
not generate predictions automatically.

## Display states

- Health `null`: show `Not enough health data`, not `0`.
- Forecast probability `null`: show `Prediction unavailable`, not `0% delay`.
- Forecast `insufficient_data`: show `Complete at least one scored sprint`.
- Risk count missing: show `—` if health failed; show `0` only when health loaded
  successfully and `risk.counts` is empty.
- One project request failing must not blank the entire portfolio.
- Show a small retry action on the affected card.
- Clamp ring values to `0–100` only for rendering; retain the API value for
  diagnostics.

## Acceptance checklist

- Each project assessment/health tab displays one **AI Generate** button.
- Clicking the button sends the current project ID, selected provider, and exact
  selected model to `POST /v1/projects/:projectId/ai-assessment/refresh`.
- The button is disabled and shows `Analyzing…` until the request finishes.
- A successful response redraws health, quality, risk, and forecast cards from
  the returned dataset without a second fetch.
- A failed response preserves previous values and presents the API message plus
  a retry action.
- Missing AI evidence is displayed as `Unknown` or `Not enough data`, never `0`.
- Organization and projects are filtered by the selected organization ID.
- Project count uses `dataset.total`.
- Health rings use `/health`, not `project_context`.
- Average health excludes missing values.
- Risk totals use `risk.counts` from successful health responses.
- Missing predictions never render as `0% delay`.
- Project cards load independently with bounded concurrency.
- Sync is user-triggered and followed by a health/forecast reload.
- API envelope `action_status` is checked for all responses.
