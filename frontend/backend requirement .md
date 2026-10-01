# Backend Requirements: AI Project Intelligence Platform (from the frontend)

**For:** backend team · **From:** frontend review of 2026-09-19 (see `report.md`) · **Updated:** 2026-09-20
**Base URL:** `/v1` · **Casing:** snake_case with `_id` (the frontend converts to camelCase)

Priorities:
- **P0**: blocks correctness or security. Needed before release.
- **P1**: the UI currently shows numbers it makes up itself or has to guess. Needed for trustworthy data.
- **P2**: missing features. The UI is already built, or can be built quickly.

Each item gives the endpoint, what it does today, what the frontend needs, why, and how to check it is done.

---

## 0. Conventions for every route

### 0.1 Success envelope (unchanged)
```json
{ "response": {
    "status":  { "action_status": true, "msg": "OK" },
    "dataset": { }
} }
```
- **Lists:** `dataset` is `{ "rows": [...], "count": 120, "page": 1, "limit": 20, "total_pages": 6 }`.
- **Single record not found:** return HTTP 404 with `action_status: false`, not `dataset: []` or `{}`.

### 0.2 Error envelope (required everywhere, including 401, 403, 404, 409, 422, 429 and 500)
```json
{ "response": {
    "status":  { "action_status": false, "msg": "Human-readable message", "code": "SYNC_COOLDOWN" },
    "dataset": { "next_sync_available_at": "2026-09-20T10:15:00Z" }
} }
```
- Some routes still reply with a bare `{ "message": "..." }` on 400. Please move them to the envelope.
- `msg` is shown to the user. Do not put stack traces or file paths in it; `test5_logical.json` in this repo is an HTML error page containing a stack trace with local paths.
- **Stable `code` values** the UI will branch on:

| code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Token missing or expired |
| `FORBIDDEN` | 403 | Role or organization does not allow this action |
| `NOT_FOUND` | 404 | Record missing |
| `VALIDATION_ERROR` | 400/422 | Put field errors in `dataset.errors: { field: message }` |
| `NO_GITHUB_INTEGRATION` | 400 | Sync requested with no GitHub integration |
| `SYNC_IN_PROGRESS` | 409 | A sync is already running |
| `SYNC_COOLDOWN` | 429 | Include `dataset.next_sync_available_at` |

- **Where `code` goes:** today the UI reads `code` from `dataset.code` (`src/App.tsx:281`). Put it in `status.code`, and keep a copy in `dataset.code` until the frontend switches over.

### 0.3 Missing values
If the backend has no evidence for a metric, send **`null`, never `0`**. `0` is shown to users as a real measurement, for example "0% delay" or "0h review latency". This matches the rule already in `spec_ai_generate.md`.

---

## P0: Blocking

### P0-1. Tell the frontend who is logged in
**Endpoint:** `POST /user/generateToken` (extend it), or add `GET /user/me`. `GET /user/me` is preferred because the frontend also needs it after a page reload.

**Today:** the response contains only `{ access_token, refresh_token }`. The frontend does not know the user, so:
- it hard-codes organization `6aa25d1cb8cdc6b232abe540` (`src/App.tsx:65`);
- it copies `owner_id` from another project when creating one;
- the role is always shown as "Developer";
- the user is lost when the page reloads.

**Required:**
```json
"dataset": {
  "access_token": "…",
  "refresh_token": "…",
  "user": {
    "_id": "…",
    "email": "admin@aiproject.local",
    "first_name": "Asha",
    "last_name": "Rao",
    "role": "org_admin",
    "organization_id": "…",
    "organizations": [{ "_id": "…", "name": "DevStudio Solutions", "role": "org_admin" }]
  }
}
```
`GET /user/me` should return the same `user` object.

**Done when:** a user from a second organization logs in and sees only that organization's projects. The frontend can then delete the hard-coded ID.

---

### P0-2. Stop sending integration secrets to the browser
**Endpoints:** `GET /projects/:id/integrations`, `GET /integrations/:id`, and the responses of `POST` and `PUT /integrations`.

**Today:** the list returns the stored GitHub/Taiga `token`, and possibly `password`. The UI can display the token (`components/IntegrationsView.tsx:813-828`). Anyone who can view the project can read the credentials.

**Required:** never return `token`, `password` or cached `auth_token`. Return flags instead:
```json
{
  "_id": "…",
  "provider": "github",
  "repository_name": "web-app",
  "username": "taiga-bot",
  "has_token": true,
  "has_password": false,
  "status": 1,
  "sync_status": "success",
  "last_sync_at": "…"
}
```
Writes stay the same: `POST` and `PUT` still **accept** `token` and `password`.

**Done when:** no integration response body contains a secret value.

---

### P0-3. Make the server the only record of plans
**Endpoints:** `/plans` (alias `/ai/plans`)

**Today:** there is no way to update or delete a plan, and accepting a plan does not reliably set its status. The frontend therefore keeps the accepted plan and any edits in browser localStorage. The Plan tab and the Execution tab then disagree, and edits never reach the checklist or Taiga.

**Required:**

| Method + path | Body | Returns |
|---|---|---|
| `PUT /plans/:id` | Partial: `{ "name"?, "plan"?: SprintPlan }` | The updated plan record |
| `DELETE /plans/:id` | — | `{ "deleted": true }` (a soft delete is fine) |
| `POST /plans/:id/accept` (existing) | — | Sets `status: "accepted"` and `accepted_at`. Only **one** accepted plan per project: any previously accepted plan becomes `superseded` |
| `GET /plans?project_id=&status=&page=&limit=&sort=-created_at` | — | Paginated `{ rows, count, page, limit, total_pages }` |

The plan record should look like this:
```json
{
  "_id": "…",
  "project_id": "…",
  "status": "draft | accepted | superseded",
  "accepted_at": null,
  "generated_by": "gemini | heuristic-fallback | manual",
  "model": "…",
  "input": { },
  "plan": { },
  "created_at": "…",
  "updated_at": "…"
}
```

Also:
- `PUT` on an accepted plan should update its execution items, or return `409` with code `PLAN_ACCEPTED` if editing an accepted plan is not allowed. **Please decide which.**
- Manual (non-AI) plans need a way in: `POST /plans` with `{ "manual": true, "plan": {…} }`.
- **Require Bearer auth** on every `/plans` route. They are open today.

**Done when:** accepting and editing a plan in one browser shows the same plan in another browser and in the Execution tab.

---

### P0-4. Tie password reset to the OTP
**Endpoints:** `POST /user/verifyOtp`, then `POST /user/resetPassword`

**Today:** `resetPassword` receives only `{ email, password, confirm_password }`. **Please confirm:** if the server does not check that the OTP was verified for this email, anyone who knows an email address can reset that account's password.

**Required:**
- `verifyOtp` returns `{ "reset_token": "…", "expires_at": "…" }`. The token should be single-use and short-lived, e.g. 10 minutes.
- `resetPassword` requires `{ email, reset_token, password, confirm_password }`. Without a valid token it returns `400` with code `INVALID_RESET_TOKEN`.
- Return password-policy failures as `VALIDATION_ERROR` with a clear `msg`.

---

## P1: Real data instead of numbers made up in the browser

### P1-1. Risk prediction
**Endpoints:** `POST /projects/:id/risks/analyze`, `GET /projects/:id/predictions`

**Today:**
- `analyze` returns risk levels and `confidence`, but no delay probability.
- The frontend makes one up from a fixed table (CRITICAL=88, HIGH=66, MEDIUM=42, LOW=18; `lib/api/risk.ts:110`) and shows it as "Explainable AI".
- It also uses `confidence` as a stand-in for delay probability.

**Required** (the prediction record, returned by both endpoints; `analyze` should also **save** it):
```json
{
  "_id": "…",
  "project_id": "…",
  "delay_probability": 64,
  "predicted_finish_date": "2026-11-28",
  "confidence": 0.72,
  "project_health": 58,
  "feature_importances": [
    { "feature": "pr_review_latency", "weight": 31, "description": "PRs wait 41h on average" }
  ],
  "recommendations": ["…"],
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "generated_at": "…"
}
```
- `delay_probability` is 0–100. `confidence` is 0–1. Any of these fields may be `null` when unknown.
- **Please confirm:** does `analyze` currently save a prediction?

---

### P1-2. Fill in the analytics bundle
**Endpoint:** `GET /projects/:id/analytics`

**Today:** PR, churn, bug and QA fields are always 0. The frontend works around it by calculating them from one page of commits and PRs, and it shows code coverage labelled as "QA capacity".

**Required** (add these; `null` when unknown):
```json
{
  "health": { },
  "progress": { },
  "velocity": { "planned_points": 40, "completed_points": 31, "sprints_observed": 4 },
  "pr_metrics": {
    "avg_review_latency_hours": 18.5,
    "avg_merge_time_hours": 30.2,
    "open_count": 7,
    "stale_open_count": 2
  },
  "code_churn": { "additions": 5230, "deletions": 1880, "window_days": 14 },
  "bug_metrics": { "open": 12, "closed_last_14d": 9, "escaped": null },
  "qa_capacity": { "capacity_percentage": null, "code_coverage": 61 },
  "computed_at": "…"
}
```
Also add `review_time_hours` (or `null`) to each pull request from `GET /projects/:id/git/pull-requests`. Every PR currently shows "0h".

---

### P1-3. Completion forecast shape
**Endpoint:** `GET /projects/:id/predictions/completion`

**Mismatch:** `spec_ai_generate.md` defines `p50`/`p80`/`p95` **inside `forecast`**. One frontend reader (`lib/api/risk.ts:263`) looks for `p50` **at the top level**, so it probably always gets `null` and the forecast shows as empty on Overview and Risk.

**Please confirm** that the response follows the spec:
```json
{
  "confidence": "medium",
  "remaining_story_points": 84,
  "velocity": { "average": 21, "std_dev": 4.2, "sprints_observed": 4 },
  "forecast": {
    "status": "simulated",
    "on_time_probability": 0.63,
    "p50": "2026-11-20",
    "p80": "2026-12-04",
    "p95": "2026-12-18",
    "optimistic": "2026-11-10"
  }
}
```
The frontend will then read it from `forecast.*` everywhere.

---

### P1-4. Work items
**Endpoints:** `GET /projects/:id/work-items`, `PUT /work-items/:id`

**Today:** there is no `priority` on read, so the UI shows MEDIUM for everything. `assignee_id` is shown raw, as an ID.

**Required** on each item:
```json
{
  "_id": "…",
  "project_id": "…",
  "sprint_id": "…",
  "title": "…",
  "story_points": 3,
  "type": "story | task | bug | epic | subtask",
  "status": "todo | in_progress | in_review | blocked | done | cancelled",
  "priority": "critical | high | medium | low",
  "assignee_id": "…",
  "assignee_name": "Ravi K"
}
```

**Please confirm the status list.** The frontend currently maps `blocked` to "In testing". If the backend has an `in_review` or `in_testing` status, send it and we will map it properly; otherwise the UI will show "Blocked".

Also add `GET /projects/:id/members` → `[{ _id, name, email }]` for the assignee dropdown, or confirm the existing route.

---

### P1-5. Project status: lifecycle vs. delivery health
**Endpoints:** `POST`, `PUT` and `GET /projects`

**Today:** `status` is a number from 1 to 5 whose meaning is not documented. The frontend writes both "at risk" and "delayed" as `2` (on hold), and reads numeric values as "on track".

**Required:**
- Document the numeric codes, e.g. `1 active · 2 on_hold · 3 completed · 4 archived · 5 cancelled`. **Please confirm.**
- Return delivery health as a separate, backend-computed field:
  ```json
  "delivery_status": "on_track | at_risk | delayed | null"
  ```
  The frontend will stop writing delivery health into `status`.

---

### P1-6. Sync results and history
**Endpoints:** `POST /integrations/:id/sync`, `GET /integrations/:id/sync-history`, `POST /projects/:id/sync`

**Please confirm:**
1. Sync responses use the standard `response.dataset` envelope. `docs/integration-sync-postman.md` shows an older `{ status, status_message, data_sets }` shape; if that is stale, please update the doc.
2. The type of `items_synced` in history rows. The frontend expects a **number**. If it is an object, send `records_synced` instead:
   ```json
   {
     "_id": "…",
     "created_at": "…",
     "status": "success | partial | failed",
     "duration_ms": 8120,
     "error_message": null,
     "records_synced": { "commits": 42, "pull_requests": 6, "stories": 0, "tasks": 0 }
   }
   ```
3. `POST /projects/:id/sync` (sync every integration on a project) should use the error codes in §0.2. The frontend will wire the Navbar "Sync" button to it.

---

### P1-7. AI attribution and model selection
**Endpoints:** `POST /ai/chat`, `POST /projects/:id/ai-assessment/refresh`, report generation, `POST /ai/providers/switch`

**Required:**
- Every AI response includes `"provider"` and `"model"` (the ones actually used). The UI currently hard-codes "Gemini 3.6 Flash".
- `POST /ai/providers/switch { "provider": "gemini", "model": "gemini-2.5-flash" }` saves **both** fields and returns them. The frontend currently keeps the model choice in the browser only.
- **Please confirm** the body for `ai-assessment/refresh`. The spec says `{ sync, provider, model }`; the frontend sends `{ sync }` only.

---

### P1-8. What-if scenario
Only needed if product keeps the AI Assistant simulator; today it ignores its inputs.

| Method + path | Body | Returns |
|---|---|---|
| `POST /projects/:id/predictions/scenario` | `{ "pr_review_latency_hours": 12, "qa_capacity_percentage": 80, "team_size": 6 }` | The same shape as the prediction record in P1-1, **not saved**, plus `"baseline_delay_probability"` |

If this is not planned, the frontend will hide the simulator.

---

## P2: Missing features (from `remaining.md` and `intplan.md`)

| Area | Method + path | Body | Returns |
|---|---|---|---|
| Reports | `POST /reports/:id/generate` | `{}` | `{ _id, status }` |
| | `GET /reports/:id/status` | — | `{ status, progress_pct?, error? }` |
| | `GET /reports/:id/export/:fmt` (`pdf`, `csv`, `xlsx`, `html`) | — | File download |
| | `POST /reports/:id/send` | `{ to: [], subject?, body? }` | `{ queued: true }` |
| Sprints | `PUT /sprints/:id` (add field) | `{ retrospective_notes }` | Updated sprint; also returned by `GET /sprints/:id/retrospective` |
| Projects | `GET /projects?search=&status=&sort=&page=&limit=` | — | Paginated list |
| Organization | `GET` / `PUT /organizations/:id/settings` | Settings object | Settings |
| | `GET` / `POST /organizations/:id/members`, `DELETE /organizations/:id/members/:userId` | `{ email, role }` | Members `{ rows: [{ _id, name, email, role }] }` |
| Teams | `GET` / `POST /teams`, `DELETE /teams/:id` | `{ name, description, member_ids }` | Team |
| Employees | `GET /employees` | — | `[{ _id, full_name, email, designation, role }]` |
| Departments | `PUT /departments/:id`, `DELETE /departments/:id` | Partial department | Updated / `{ deleted: true }` |
| Notifications | `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | — | `{ updated: n }` |
| | `GET` / `PUT /notification-preferences` | `[{ event_type, in_app, email }]` | Preferences |
| | Emit notifications on `risk_alert`, `deadline_slip`, `sync_failed`, `sprint_closeout`, `report_ready` | — | `{ _id, type, title, body, payload, read_at, created_at }` |
| Settings | `GET /feature-flags` | — | `[{ key, value, description }]` |
| | `GET /integrations/providers` | — | `[{ id, name, type }]` |
| Health | Confirm `PUT /projects/:id/health/strategy { strategy_id }` exists | | |

### P2-RBAC. Role and organization enforcement
- Check organization membership on **every** project-scoped route. Return `403 FORBIDDEN` if the user is not a member.
- Enforce roles on writes, e.g. only `org_admin`/`super_admin` can manage members, and `viewer` cannot write.
- Please document the role matrix; the frontend will hide controls to match. Hiding buttons in the UI is not a security boundary; the backend must enforce it.
- When inviting members, confirm which role maps to "Admin": `org_admin`, not `super_admin`.

---

## Open questions for the backend team

| # | Question | Blocks |
|---|---|---|
| 1 | Completion forecast: is `p50` nested under `forecast` (as the spec says)? | P1-3 |
| 2 | Do integration responses currently include `token` or `password`? | P0-2 |
| 3 | Does `resetPassword` currently check that the OTP was verified? | P0-4 |
| 4 | Does `POST /risks/analyze` save a prediction? | P1-1 |
| 5 | Is editing an accepted plan allowed (update the execution items) or blocked (409)? | P0-3 |
| 6 | Full work-item status list: is there an `in_review` or `in_testing` status? | P1-4 |
| 7 | Numeric project status codes 1–5: what does each mean? | P1-5 |
| 8 | Is `items_synced` a number or an object? Which envelope does sync use? | P1-6 |
| 9 | Does `/ai/providers/switch` save `model`? What is the correct refresh body? | P1-7 |
| 10 | Does `GET /plans/:id/execution` ever return 304? The frontend would prefer 200 always. | — |
| 11 | Is a scenario endpoint planned, or should the simulator be removed? | P1-8 |

---

## Frontend commitments once each item lands

| Backend item | Frontend change |
|---|---|
| P0-1 user / me | Remove the hard-coded org ID, set the owner automatically, restore the user on reload, use real roles |
| P0-2 secret flags | Show "Token saved ✓" instead of the value |
| P0-3 plans | Remove the localStorage plan store; the Plan and Execution tabs read the same server record |
| P0-4 reset token | Send `reset_token` and add a confirm-password field |
| P1-1 / P1-2 / P1-3 | Remove all browser-made-up metrics; show "not available" for `null` |
| P1-4 | Real priority and assignee names on the Kanban board |
| P1-6 | Wire the Navbar "Sync" button; show cooldown and in-progress states |
| P1-7 | Show the provider and model actually used |

> Keep this file current: when a route ships or its shape changes, update the matching section and mark it ✅ with the date.
