# Plan Implementation — AI Sprint Plan Generator (`/v1/plans`)

> UI integration guide for the AI planning endpoint.
> Backend: TypeScript / Express / Mongoose (modular monolith) — base URL `http://localhost:3000`
> Status: **implemented & live-tested** (2026-09-10)

---

## 1. What this API does (the flow)

```
UI form (project description + planning inputs)
        │  POST /v1/plans
        ▼
Backend builds a strict "agile planner" prompt
        │
        ▼
Gemini (google_provider) generates the plan
        │                                   ┌─ provider OK ──► JSON parsed
        ▼                                   │
JSON parse + date normalization ◄───────────┤
        │                                   └─ provider fails ──► rule-based fallback plan
        ▼
Stored in Mongo (`ai_plans`) ──► response { id, generated_by, plan }
        │
        ▼
UI renders sprints / tasks / milestones / deadlines
```

The API **always** answers `200` with a usable plan — if the AI provider is
down or returns invalid JSON, a deterministic fallback plan is returned with
`generated_by: "heuristic-fallback"` (same convention as the existing
`/v1/ai/chat/summary` fallback).

---

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/plans` | Generate an AI sprint/deadline plan from input |
| `GET`  | `/v1/plans?project_id=...` | List saved plans (optionally per project) |
| `GET`  | `/v1/plans/:id` | Fetch one saved plan |
| `POST` | `/v1/ai/plans` | Identical to `POST /v1/plans` (canonical mount) |

Notes:
- **CORS is open** (`origin: '*'`) — browser calls from any dev origin work.
- **No auth is required** on these routes today (see checklist §3, item 8).
- Every response uses the platform envelope (see §5).

---

## 3. ⚠️ INFO NEEDED FROM THE UI TEAM (checklist)

Please answer these so the integration can be finalized:

1. **Frontend stack** — React + TypeScript + Tailwind + TanStack Query (as in
   `frontend-integration-helper.md`)? Any component/state conventions to match?
2. **Where does the call live?** A standalone "AI Planner" page, or inside an
   existing project workspace (determines whether `project_id` is sent)?
3. **Form design** — which inputs are user-facing vs fixed defaults?
   (`description`, `project_name`, `team_size`, `duration_weeks`,
   `sprint_length_weeks`, `start_date`, `constraints[]`)
4. **Project linking** — should plans be tied to an existing project
   (`project_id`) so `GET /v1/plans?project_id=` filtering is used?
5. **"Apply plan" feature?** — push generated sprints/tasks into the real
   `/v1/sprints` and `/v1/work-items` collections (needs a new backend endpoint)?
6. **Regenerate / edit** — is a `PUT /v1/plans/:id` (edit) or regenerate button
   needed?
7. **Delete** — is `DELETE /v1/plans/:id` needed?
8. **Auth** — keep these routes open, or protect them with the same token flow
   as `/v1/user/*`?
9. **List shape** — `GET /v1/plans` currently returns *all* plans in insertion
   order (no pagination/sort). Do you need pagination, sorting, or filtering?
10. **Loading budget** — AI generation takes ~5–25 s typically (worst case
    ~90 s with provider retries). What loading UX do you want (spinner,
    progressive steps, background + poll)?
11. **Language** — AI output is English; any i18n requirement?
12. **Proxy** — will the UI hit `localhost:3000` directly or through a dev
    proxy? (Both work; CORS is open.)

<!-- APPEND -->
