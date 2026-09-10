# Project Data Requirements

## 1. Purpose

This document defines the complete data set required to render every project intelligence section. A project response should be assembled from the project record, organization members, work management data, Git data, integrations, analytics, risks, AI results, reports, notifications, and audit/sync metadata.

The document uses the following conventions:

- IDs are stable strings and must be unique within their entity type.
- Dates are ISO 8601 UTC strings.
- Percentages are numbers from 0 to 100 unless explicitly marked as a ratio from 0 to 1.
- Counts and story points are non-negative numbers.
- Nullable values must be returned as `null`, not omitted, when the UI needs to distinguish "not available" from zero.
- Every persisted record should include `createdAt` and `updatedAt` or their API equivalents `created_at` and `updated_at`.

## 2. Common Response Contract

All API responses should use the project response envelope:

```json
{
  "response": {
    "dataset": {},
    "status": {
      "msg": "Request completed.",
      "action_status": true
    },
    "publish": {
      "version": "1.0.0",
      "developer": "aiproject"
    }
  }
}
```

For list endpoints, `dataset` should contain:

```json
{
  "rows": [],
  "count": 0,
  "page": 1,
  "limit": 20,
  "total_pages": 0
}
```

Required request behavior:

- Return `action_status: false` with a useful `msg` when a project or related record is missing.
- Return field-level validation errors in `response.data`.
- Include the selected `projectId` in every project-scoped request.
- Apply the current user's organization and access scope on server-side queries.
- Return empty arrays for valid sections with no records.

## 3. Identity and Organization Data

### 3.1 Organization

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `id` | string | Yes | Organization identifier |
| `name` | string | Yes | Display name |
| `description` | string | No | Organization summary |
| `githubOrg` | string | No | Connected GitHub organization |
| `taigaOrg` | string | No | Connected Taiga organization |
| `settings` | object | No | Organization-level preferences |
| `createdAt` | datetime | Yes | Creation time |
| `updatedAt` | datetime | Yes | Last update time |

### 3.2 User and Project Members

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `id` | string | Yes | User identifier |
| `organizationId` | string | Yes | Owning organization |
| `name` / `fullName` | string | Yes | Display name |
| `email` | string | Yes | Login and notification address |
| `role` | enum | Yes | `ADMIN`, `TECH_LEAD`, `ENG_MANAGER`, `DEVELOPER`, or backend role |
| `avatar` / `avatarUrl` | string | No | Profile image |
| `isActive` | boolean | Yes | Whether the user can be assigned work |
| `departmentId` | string | No | Workforce department |
| `teamId` | string | No | Workforce team |
| `joinedAt` | datetime | No | Membership date |

Project membership additionally requires:

- `projectId`
- `userId`
- `projectRole`
- `allocationPercentage`
- `isActive`

## 4. Project Core Data

### 4.1 Project Record

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `id` | string | Yes | Project identifier |
| `organizationId` | string | Yes | Owning organization |
| `name` | string | Yes | Project title |
| `description` | string | No | Project summary |
| `ownerId` | string | Yes | Project owner or manager |
| `status` | enum | Yes | `active`, `on_hold`, `completed`, `archived`, `cancelled` |
| `startDate` | date | No | Planned start |
| `deadline` / `targetDate` | date | No | Planned completion |
| `actualCompletionDate` | date | No | Actual completion |
| `healthScore` | number | No | Overall score from 0 to 100 |
| `delayProbability` | number | No | Predicted delay percentage |
| `keyRiskFactors` | string[] | No | Human-readable risk drivers |
| `lastSyncAt` | datetime | No | Latest successful or attempted sync |
| `createdAt` | datetime | Yes | Creation time |
| `updatedAt` | datetime | Yes | Last update time |

### 4.2 Project Card Summary

The project list and portfolio dashboard require this compact projection:

```json
{
  "id": "project-001",
  "name": "Mobile App",
  "status": "active",
  "health": {
    "score": 74,
    "trend": "up",
    "calculationVersion": "v1",
    "lastEvaluated": "2026-09-04T09:43:52.629Z"
  },
  "progress": {
    "percentComplete": 34,
    "completedPoints": 27,
    "plannedPoints": 80
  },
  "openRiskCount": 2,
  "activeSprint": {
    "id": "sprint-001",
    "name": "Sprint 1",
    "endDate": "2026-09-12"
  },
  "lastSyncAt": "2026-09-04T09:43:52.629Z"
}
```

## 5. Project Workspace Overview

The project workspace overview must provide these sections in one read or through equivalent section endpoints:

- Project identity, owner, status, dates, and last sync.
- Health score and health trend.
- Delivery delay probability and confidence.
- Current sprint completion.
- Work item progress and story point totals.
- PR review latency and stale PR count.
- Code churn: additions, deletions, changed files, and churn ratio.
- Open risks and top risk factors.
- Milestones and dependencies.
- Latest AI summary and recommendations.

Required overview metrics:

```json
{
  "healthScore": 74,
  "healthTrend": "up",
  "delayProbability": 41,
  "predictionConfidence": 89,
  "progressPercent": 34,
  "openRiskCount": 2,
  "blockedItemCount": 2,
  "activeSprintCompletionPercent": 68,
  "averagePrReviewHours": 14.5,
  "stalePrCount": 1,
  "codeChurn": {
    "additions": 4200,
    "deletions": 1300,
    "changedFiles": 84,
    "churnRatio": 0.31
  }
}
```

## 6. Work Management Data

### 6.1 Work Item

| Field | Type | Required | Purpose |
|---|---|---:|---|
| `id` | string | Yes | Work item identifier |
| `projectId` | string | Yes | Parent project |
| `sprintId` | string | No | Assigned sprint |
| `source` | enum | Yes | `taiga`, `github`, `manual` |
| `externalId` | string | No | Source-system identifier |
| `title` | string | Yes | Card title |
| `description` | string | No | Full description |
| `type` | enum | Yes | `story`, `task`, `bug`, `epic`, `subtask` |
| `status` | enum | Yes | `todo`, `in_progress`, `blocked`, `done`, `cancelled` |
| `priority` | enum | Yes | `low`, `medium`, `high`, `urgent` |
| `assigneeId` | string | No | Assigned user |
| `storyPoints` | number | Yes | Delivery effort |
| `blockedReason` | string | No | Why the item is blocked |
| `dueDate` | date | No | Item target date |
| `labels` | string[] | No | Filterable labels |
| `createdAt` | datetime | Yes | Creation time |
| `updatedAt` | datetime | Yes | Last update time |

Required work-item operations:

- Filter by status, type, priority, assignee, sprint, and source.
- Move between statuses.
- Change assignee and priority.
- Display item history and dependencies.
- Return status counts and point totals for each board column.

### 6.2 Milestone and Dependency

Milestone fields:

- `id`, `projectId`, `name`, `description`
- `targetDate`, `completedAt`, `status`
- `plannedPoints`, `completedPoints`
- `ownerId`, `workItemIds`

Dependency fields:

- `id`, `projectId`, `fromItemId`, `toItemId`
- `dependencyType` (`blocks`, `depends_on`, `related`)
- `status` (`open`, `resolved`)
- `riskLevel`, `description`, `resolvedAt`

## 7. Sprint Intelligence Data

### 7.1 Sprint

| Field | Type | Required |
|---|---|---:|
| `id` | string | Yes |
| `projectId` | string | Yes |
| `name` | string | Yes |
| `goal` | string | No |
| `startDate` | date | No |
| `endDate` | date | No |
| `status` | enum | Yes |
| `plannedPoints` | number | Yes |
| `completedPoints` | number | Yes |
| `isClosed` | boolean | Yes |
| `velocity` | number | No |
| `workItemIds` | string[] | No |

### 7.2 Sprint Charts and Summary

The sprint section requires time-series records with one record per date:

```json
{
  "date": "2026-09-04",
  "remainingPoints": 55,
  "completedPoints": 25,
  "totalPoints": 80,
  "plannedRemainingPoints": 58,
  "pointsCompleted": 5
}
```

The sprint summary requires:

- Current velocity and average velocity.
- Planned, completed, remaining, and carried-over points.
- Burndown start and end points.
- Burnup completion percentage.
- Scope added or removed during the sprint.
- Days remaining and schedule status.
- Retrospective notes, actions, owners, and due dates.

## 8. Git and Delivery Data

### 8.1 Repository

| Field | Type | Required |
|---|---|---:|
| `id` | string | Yes |
| `projectId` | string | Yes |
| `provider` | enum | Yes |
| `name` / `repoName` | string | Yes |
| `url` | string | Yes |
| `defaultBranch` | string | Yes |
| `visibility` | enum | No |
| `stars` | number | No |
| `openIssues` | number | No |
| `lastSyncAt` | datetime | Yes |

### 8.2 Commit

Required fields: `id`, `repositoryId`, `sha`, `authorId`, `authorName`, `message`, `committedAt`, `filesChanged`, `additions`, `deletions`, and `url`.

### 8.3 Pull Request

Required fields: `id`, `repositoryId`, `number`, `title`, `authorId`, `state`, `createdAt`, `updatedAt`, `mergedAt`, `reviewTimeHours`, `commentsCount`, `changedFiles`, `additions`, `deletions`, and `reviewerIds`.

Allowed states: `open`, `merged`, `closed`.

### 8.4 Reviews, Releases, and Contributors

Review fields: `id`, `pullRequestId`, `reviewerId`, `state`, `submittedAt`, `commentsCount`.

Release fields: `id`, `repositoryId`, `tagName`, `name`, `createdAt`, `publishedAt`, `authorId`, `commitCount`, and `url`.

Contributor fields: `id`, `repositoryId`, `userId`, `username`, `avatarUrl`, `totalCommits`, `totalAdditions`, `totalDeletions`, and `activeDays`.

### 8.5 DORA and Git Activity

DORA response fields:

```json
{
  "range": { "from": "2026-08-29", "to": "2026-09-04" },
  "deployFrequencyPerWeek": 3,
  "leadTimeHours": 41.5,
  "changeFailureRate": 0.0,
  "mttrHours": null,
  "commits": 29,
  "prsMerged": 3,
  "activity": [
    {
      "date": "2026-09-04",
      "commitCount": 3,
      "prCount": 0,
      "reviewCount": 0
    }
  ]
}
```

## 9. Analytics and Health Data

### 9.1 Project Health

| Field | Type | Required |
|---|---|---:|
| `projectId` | string | Yes |
| `score` | number 0-100 | Yes |
| `components.schedule` | number 0-100 | Yes |
| `components.progress` | number 0-100 | Yes |
| `components.velocity` | number 0-100 | Yes |
| `components.quality` | number 0-100 | Yes |
| `components.risk` | number 0-100 | Yes |
| `components.delivery` | number 0-100 | Yes |
| `calculationVersion` | string | Yes |
| `evaluationStrategy` | string | Yes |
| `lastEvaluated` | datetime | Yes |
| `trend` | enum | No |

Health strategies require `id`, `name`, `description`, `weights`, and `isDefault`.

### 9.2 Analytics Metrics

The analytics bundle should include:

- `progressPercent`, planned points, completed points, and remaining points.
- Current velocity, average velocity, velocity trend, and forecast velocity.
- Bug count, open bug count, resolved bug count, code coverage, defect density, and escaped defects.
- PR count, merged PR count, review time, stale PR count, and deployment count.
- Six health component scores and the weighted total.
- Daily or weekly trend series with `date`, `value`, `metric`, and `period`.

### 9.3 Daily Snapshot

```json
{
  "id": "snapshot-001",
  "entityType": "project",
  "entityId": "project-001",
  "snapshotDate": "2026-09-04",
  "data": {
    "health": 74,
    "progress": 34,
    "velocity": 18,
    "openRisks": 2,
    "blockedItems": 2
  }
}
```

## 10. Workforce and Team Data

Required entities are departments, teams, employees, and organization members.

Department fields: `id`, `organizationId`, `name`, `description`, `managerId`.

Team fields: `id`, `organizationId`, `name`, `description`, `memberIds`, `leadId`.

Employee fields: `id`, `fullName`, `email`, `designation`, `departmentId`, `teamId`, `role`, `capacityHoursPerWeek`, and `isActive`.

Workforce metrics:

- `totalItems`, `statusBreakdown`, `completionRate`.
- `plannedPoints`, `completedPoints`, `blockedPoints`.
- `commitCount`, `codeChurn`, `reviewTimeHours`.
- `bugsAssigned`, `bugsResolved`, `velocityPoints`, and `workloadStatus`.
- `aiScore` when an AI efficiency score has been calculated.

## 11. Risk and Prediction Data

### 11.1 Risk Record

Required fields: `id`, `projectId`, `riskType`, `severity`, `description`, `mitigated`, `ownerId`, `detectedAt`, `mitigatedAt`, `source`, and `evidence`.

Allowed severity values: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

### 11.2 Risk Analysis

```json
{
  "score": 0.72,
  "level": "HIGH",
  "signals": {
    "blockedDependencies": 2,
    "velocityTrend": -0.15,
    "prLeadTimeRatio": 1.3,
    "bugInflowRate": 0.4,
    "scopeCreep": 0.1,
    "deadlineMarginDays": -3
  },
  "topDriver": "blockedDependencies",
  "evaluatedAt": "2026-09-04T09:43:52.629Z"
}
```

Risk level thresholds must be consistent: `LOW` below 0.4, `MEDIUM` from 0.4 up to 0.7, and `HIGH` at or above 0.7.

### 11.3 Completion Prediction

Required fields:

- `projectId`, `predictedFinishDate`, `confidence`.
- `delayProbability`, `targetDate`, `velocityForecast`.
- Completion percentiles: `p50`, `p80`, `p95`.
- `recommendations`, `featureImportances`, and `generatedAt`.
- AI provider and model used.

## 12. AI Intelligence Data

### 12.1 AI Summary and Recommendations

Summary fields: `projectId`, `summaryText`, `generatedAt`, `provider`, `model`, `sourceSnapshotAt`.

Recommendation fields: `id`, `projectId`, `text`, `priority`, `category`, `ownerId`, `status`, `dueDate`, `evidence`, and `createdAt`.

Allowed recommendation priorities: `low`, `medium`, `high`, `critical`.

### 12.2 AI Chat

Request fields: `projectId`, `message`, and optional `conversationId`.

Response fields:

```json
{
  "conversationId": "conversation-001",
  "intent": "explanation",
  "answer": "Health fell after two blocked items were discovered.",
  "citations": [
    { "metric": "blocked_items", "value": 2, "source": "work-items" }
  ],
  "createdAt": "2026-09-04T09:43:52.629Z"
}
```

Allowed intents: `metric_lookup`, `explanation`, `recommendation`, `freeform`.

Conversation fields: `id`, `projectId`, `userId`, `title`, `messages`, `createdAt`, and `updatedAt`.

## 13. Integrations and Synchronization

### 13.1 Integration

Required fields: `id`, `projectId`, `provider`, `repositoryName`, `repositoryUrl`, `status`, `lastSyncAt`, `lastSyncStatus`, `lastSyncMessage`, and `createdAt`.

Allowed providers: `github`, `taiga`.

Allowed statuses: `0` inactive, `1` active, `2` error.

Tokens and secrets must never be returned to the browser. Return only `isConfigured` or `apiKeySet`.

### 13.2 Sync Job and Sync Log

Sync job fields: `jobId`, `integrationId`, `projectId`, `status`, `startedAt`, `completedAt`, `recordsSynced`, `recordsFailed`, and `errorMessage`.

Sync log fields:

```json
{
  "id": "sync-001",
  "timestamp": "2026-09-04T09:43:52.629Z",
  "status": "SUCCESS",
  "message": "GitHub and Taiga data synchronized.",
  "recordsSynced": {
    "commits": 29,
    "prs": 3,
    "stories": 18,
    "tasks": 42
  }
}
```

Allowed sync statuses: `SUCCESS`, `WARNING`, `FAILED`, `IN_PROGRESS`.

## 14. Reports

Report fields:

- `id`, `projectId`, `name`, `format`, `status`.
- `definition` containing selected date range, sections, filters, and recipients.
- `artifactUrl`, `generatedAt`, `requestedBy`, `errorMessage`.
- `historyId`, `startedAt`, and `completedAt` for generation tracking.

Allowed formats: `pdf`, `html`, `ppt`.

Allowed statuses: `pending`, `processing`, `completed`, `failed`.

Every generated report should be able to include:

1. Executive summary.
2. Health and trend.
3. Velocity and sprint.
4. Risks and predictions.
5. Work breakdown.
6. Git and delivery metrics.
7. AI narrative.
8. Integration and synchronization status.

## 15. Notifications and Preferences

Notification fields:

| Field | Type | Required |
|---|---|---:|
| `id` | string | Yes |
| `userId` | string | Yes |
| `projectId` | string | No |
| `type` | enum | Yes |
| `title` | string | Yes |
| `body` | string | Yes |
| `payload` | object | No |
| `readAt` | datetime/null | Yes |
| `createdAt` | datetime | Yes |

Allowed types: `risk_alert`, `deadline_slip`, `sync_failed`, `sprint_closeout`, `report_ready`, `mention`, `assignment`.

Notification preference fields: `userId`, `eventType`, `inApp`, `email`, `updatedAt`.

## 16. Project API Requirements

The frontend needs these project-scoped reads and writes:

```text
GET    /v1/projects/:id
GET    /v1/projects/:id/members
GET    /v1/projects/:id/milestones
GET    /v1/projects/:id/dependencies
GET    /v1/projects/:id/settings
GET    /v1/projects/:id/analytics
GET    /v1/projects/:id/health
GET    /v1/projects/:id/health/strategies
PUT    /v1/projects/:id/health/strategy
GET    /v1/projects/:id/progress
GET    /v1/projects/:id/velocity
GET    /v1/projects/:id/quality
GET    /v1/projects/:id/analytics/trends
GET    /v1/projects/:id/work-items
GET    /v1/projects/:id/sprints
GET    /v1/projects/:id/repositories
GET    /v1/projects/:id/git/activity
GET    /v1/projects/:id/git/metrics
GET    /v1/projects/:id/risks
POST   /v1/projects/:id/risks/analyze
GET    /v1/projects/:id/predictions
GET    /v1/projects/:id/predictions/completion
POST   /v1/projects/:id/ai/analyze
POST   /v1/projects/:id/ai/summary
GET    /v1/projects/:id/ai/insights
GET    /v1/projects/:id/ai/recommendations
GET    /v1/projects/:id/integrations
GET    /v1/projects/:id/reports
```

Supporting reads and mutations:

```text
GET    /v1/repositories/:id/commits
GET    /v1/repositories/:id/pull-requests
GET    /v1/repositories/:id/reviews
GET    /v1/sprints/:id/burndown
GET    /v1/sprints/:id/burnup
GET    /v1/sprints/:id/velocity
GET    /v1/sprints/:id/summary
GET    /v1/sprints/:id/retrospective
PATCH  /v1/work-items/:id/status
PATCH  /v1/work-items/:id/assignee
PATCH  /v1/work-items/:id/priority
POST   /v1/integrations/:id/sync
GET    /v1/integrations/:id/sync-history
POST   /v1/reports/:id/generate
GET    /v1/reports/:id/status
```

## 17. Data Quality and Completeness Rules

Before a project is considered ready for display:

- The project has a valid organization, owner, status, and stable ID.
- All related records reference the same project ID.
- Work item status, type, priority, sprint, and assignee values use canonical enums.
- Sprint dates are valid and `endDate` is not earlier than `startDate`.
- Health, progress, and confidence values are within their documented ranges.
- Every chart series is sorted ascending by date and contains no duplicate dates.
- Missing optional metrics are returned as `null`; zero means a measured zero.
- Every external integration record exposes sync status and last-sync information.
- Risk records include severity and a human-readable description.
- AI outputs identify their provider, model, generation time, and source snapshot.
- Report and notification records include enough status data for polling and unread/read states.
- PII and credentials are minimized; access tokens, passwords, and API keys are never included in project payloads.

## 18. Recommended Full Project Payload

For a single request that powers the complete project workspace, return a bundle shaped like this:

```json
{
  "project": {},
  "members": [],
  "milestones": [],
  "dependencies": [],
  "overview": {},
  "health": {},
  "healthTrend": [],
  "workItems": { "rows": [], "summary": {} },
  "sprints": [],
  "activeSprint": {
    "sprint": {},
    "burndown": [],
    "burnup": [],
    "velocity": [],
    "summary": {},
    "retrospective": {}
  },
  "repositories": [],
  "git": {
    "commits": [],
    "pullRequests": [],
    "reviews": [],
    "releases": [],
    "contributors": [],
    "activity": [],
    "dora": {}
  },
  "analytics": {},
  "departmentMetrics": [],
  "risks": [],
  "riskAnalysis": {},
  "predictions": {},
  "ai": {
    "summary": null,
    "insights": [],
    "recommendations": [],
    "conversations": []
  },
  "integrations": [],
  "syncHistory": [],
  "reports": [],
  "notifications": []
}
```

This bundle may be implemented as one endpoint or composed from smaller endpoints, but every field above must be available to the corresponding project section.
