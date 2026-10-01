# `/v1/plans` integration — implementation diff + checklist answers

Companion to `planimplement.md`.

- **Part A** — what changes in the frontend, section by section (gap between what
  `lib/api/plans.ts` + `components/PlansView.tsx` do today and the real backend).
- **Part B** — answers to the §3 "INFO NEEDED FROM THE UI TEAM" checklist.
- **Part C** — the accept / edit / manual-entry flow added on top.

> **Status: implemented** (2026-09-10). `lib/api/plans.ts`, `types/index.ts`,
> `components/PlansView.tsx` rewritten; `lib/acceptedPlan.ts` added. `tsc` + `vite
> build` clean; verified against the live backend on `:3000`. Undo steps in
> `history.md` (entries `15:09` and `15:25`).

> Full spec verified against backend source at
> `aiProject2026/aiProject/backendApi/` (`planimplement.md` here is a truncated
> 83-line copy; the real one is 452 lines).
> Routes confirmed in `src/app_routing.ts` + `.../ai_intelligence/route/ai_intelligence_route.ts`.

---

## Part A — Implementation diff by section

### Summary of the mismatch

| Area | Frontend today | Real backend | Action |
|---|---|---|---|
| Create flow | 2-step: `createPlan` then `generateSprintDistribution` | 1 call, AI runs on `POST /v1/plans` (5–25 s, ≤90 s) | Collapse to one `generatePlan()` |
| `POST /plans/:id/generate-sprint-distribution` | called | **does not exist** | Delete |
| `PUT /plans/:id` (`updatePlan`) | called by "Save" button | **not implemented** | Delete + drop Save |
| `DELETE /plans/:id` (`deletePlan`) | exported | **not implemented** | Delete |
| `GET /plans?project_id=` (list) | not implemented | exists | Add `listPlans()` |
| `GET /plans/:id` (`getPlan`) | correct | exists | Keep |
| Request body | `{ projectId, name, requirements, deadline, features[] }` | `{ description*, project_name?, project_id?, team_size?, duration_weeks?, sprint_length_weeks?, start_date?, constraints[] }` | Rewrite form + body |
| Response consumed | flat `Plan` via `fromApi(res.data)` | `dataset = { id, generated_by, model, input, plan }` | Consume `.plan` + `.generated_by` |
| `plan` model | `PlanSprint {name,goal,durationDays,features[]}` | `SprintPlan` w/ sprints→tasks, milestones, deadlines, risks, assumptions | Replace types + render |
| Client timeout | none set on axios | needs ≥ 120 s | Pass `timeout: 120000` on generate |
| Loading UX | single spinner | stepped indeterminate loader + Cancel | Rebuild loader |

### §2 Endpoints
`lib/api/plans.ts` currently targets 5 paths; only 3 exist.
- **Keep:** `GET /plans/:id`.
- **Add:** `GET /plans?project_id=<id>` → `listPlans(projectId?)`.
- **Replace:** `createPlan` + `generateSprintDistribution` → single `generatePlan(input)` → `POST /plans`.
- **Remove:** `updatePlan` (PUT), `deletePlan` (DELETE), `generateSprintDistribution`.
- Base URL already `http://localhost:3000/v1` (`lib/api/env.ts`), so paths stay `/plans`.

### §4 Request
Rewrite the `PlansView` form. Fields (spec defaults in parens):
`description` (required, textarea) · `project_name` · `team_size` (4) ·
`duration_weeks` (8) · `sprint_length_weeks` (2) · `start_date` (today, `YYYY-MM-DD`) ·
`constraints[]` (textarea, one per line).
`project_id` is **injected from the selected project**, not a form field.
`toApi()` already converts `teamSize → team_size` etc., so the component can stay camelCase.

### §5 Response envelope
`lib/api/http.ts` interceptor already unwraps `response.dataset` and throws
`ApiError(msg)` on `action_status:false` — **no change needed there.**
Change only the consumer: `generatePlan` returns `fromApi(dataset)` =
`{ id, generatedBy, model, input, plan }`; render from `.plan`, badge from `.generatedBy`.

### §6 `plan` object
Replace `Plan` / `PlanSprint` in `types/index.ts` with the spec shapes
(§9): `GeneratePlanInput`, `PlanTask`, `PlanSprint` (redefined:
`index,name,goal,startDate,endDate,deadline,plannedPoints,tasks[]`),
`PlanMilestone`, `PlanDeadline`, `PlanRisk`, `SprintPlan`, `GeneratedPlan`,
`SavedPlan`. Grep first — only `plans.ts`, `PlansView.tsx`, `types/index.ts`
reference the old names.

### §7 Errors & timing
- Add `{ timeout: 120000 }` to the `generatePlan` axios call only.
- Both error shapes are already handled by `http.ts` (`bareMessage` catches the
  plain `{ "message": "description is required..." }` 400; the interceptor catches
  the enveloped `action_status:false`). `PlansView` keeps surfacing `err.msg` via `onToast`.
- Loader: indeterminate bar with rotating step hints
  ("Analyzing requirements → Dividing sprints → Estimating deadlines"); wire a
  Cancel button to an `AbortController` (`signal` on the axios call).

### §8 GET endpoints
Add `listPlans(projectId?)` — `safeRead(() => rowsOf(fromApi(dataset)), [], 'plans.list')`.
`getPlan` already correct; unknown id → 400 `"Plan not found."` → `safeRead` returns `null`.

### §9 Types
Copy the spec's TS block into `types/index.ts` (camelCase’d — `fromApi` runs on
responses so UI types are camelCase: `generated_by → generatedBy`,
`start_date → startDate`, `assignee_role → assigneeRole`, `story_points → storyPoints`).

### §10 Integration code
Spec shows plain `fetch` / TanStack Query; we keep the existing **axios adapter**
pattern (`http` + `toApi`/`fromApi` + `safeRead`). Equivalent; the
`action_status` check lives in the interceptor, not the component.

### §11 UI rendering
`PlansView` result view (replaces the editable sprint list):
- Header: `plan_name`, `summary`, `generated_by` badge (`google` → green "AI generated",
  `heuristic-fallback` → amber "Fallback plan"), `model`.
- Sprint cards: `index` · `name` · `goal` · `startDate → endDate` · `plannedPoints`;
  task table below (title, `assigneeRole`, `priority` color badge, `storyPoints`, `estimateHours`).
- Milestones: list / timeline markers (`name` + `date`).
- Deadlines: chronological list.
- Risks: cards colored by `severity` (high red / medium amber / low slate) + `mitigation`.
- Assumptions: expandable block.
- Actions: **Generate**, **Regenerate** (re-POST same input). No Save (auto-saved server-side).

### §12 Not implemented (no frontend blocker)
`PUT` / `DELETE` / list pagination / `POST /plans/:id/apply` / auth on plan routes.
Only impact: remove the frontend calls that assumed `PUT`/`DELETE`.

### Files touched
| File | Change |
|---|---|
| `lib/api/plans.ts` | Rewrite: `generatePlan`, `listPlans`, `getPlan` only |
| `types/index.ts` | Replace `Plan`/`PlanSprint` with spec types (lines ~228–247) |
| `components/PlansView.tsx` | Rewrite form (§4) + result render (§11) + stepped loader (§7) |
| `lib/api/http.ts` | No change (envelope + bare-message already handled) |
| `lib/api/index.ts` | No change (barrel re-export unaffected) |

---

## Part B — Answers to the §3 checklist

| # | Question | Answer |
|---|---|---|
| 1 | Frontend stack / conventions | React 19 + TS + Tailwind v4 + **Vite** (the `next` dep is unused; `"use client"` is vestigial). **No TanStack Query** — not installed. Server state = `useState` + `useEffect`; `src/App.tsx` is the data hub, leaf components self-fetch. Shared axios instance `lib/api/http.ts` with an envelope-unwrap interceptor; per-resource adapters in `lib/api/*.ts` using `toApi`/`fromApi` case conversion and `safeRead` for reads. Match that pattern — no new libs. |
| 2 | Where does the call live? | **Inside a project workspace** — the "Plan" tab (`components/PlansView.tsx`), mounted only when a project is selected. Not a standalone page. |
| 3 | Form: user-facing vs fixed | User-facing: `description` (required), `team_size`, `duration_weeks`, `sprint_length_weeks`, `start_date`, `constraints[]`. **Injected, not shown:** `project_id` **and `project_name`** (both from the selected project — the plan is always created inside a workspace). Defaults: `team_size 4`, `duration_weeks 8`, `sprint_length_weeks 2`, `start_date` today, `constraints []`. |
| 4 | Project linking | **Yes.** Always send `project_id` from the workspace; use `GET /v1/plans?project_id=` for the per-project history list. |
| 5 | "Apply plan" feature? | **Not in v1** (backend has no `/apply` route). "Apply to project" shows as a disabled button. Later: client-side loop creating `POST /v1/sprints` per sprint + `POST /v1/work-items` per task — **pending your go-ahead.** |
| 6 | Regenerate / edit | **Regenerate = re-POST the same input.** **Inline editing IS implemented** — the generated plan is fully editable (name, summary, sprints, tasks, dates, points, milestones, deadlines, risks, assumptions) before it is accepted. Since there is no `PUT /v1/plans/:id`, edited/accepted plans are stored client-side (Part C). |
| 7 | Delete | **Not needed for v1.** Low priority; add if the history list gets cluttered. |
| 8 | Auth | **Keep the routes open for now.** The frontend request interceptor already attaches `Authorization: Bearer <token>` whenever a token is stored, so turning on auth later is transparent to the UI. |
| 9 | List shape | All-plans-insertion-order is acceptable for v1 (few plans per project). **Newest-first sort** would be a nice-to-have. Pagination not needed yet. |
| 10 | Loading budget | Client timeout **120 s** on the generate call. **Indeterminate stepped loader** ("Analyzing requirements → Dividing sprints → Estimating deadlines") + **Cancel** button via `AbortController`. No background-job/poll mode needed. |
| 11 | Language | **English only.** No i18n requirement. |
| 12 | Proxy | **Direct** to `http://localhost:3000/v1` via `VITE_API_BASE_URL` (already set in `.env`). CORS is open; no dev proxy. |

---

## Part C — Accept / edit / manual-entry flow

The AI plan is a **draft**, not the committed plan. The team must be able to accept
it, reject it, edit it first, or author one by hand. The backend can't back any of
that yet (no plan `status`, no `PUT`, no manual-create route), so the committed
plan is stored **client-side, per project**.

### Store — `lib/acceptedPlan.ts`

`localStorage` key `aipi_plan:<projectId>` → `AcceptedPlanRecord`:

```ts
{ source: 'ai' | 'manual', acceptedAt, planId?, generatedBy?, model?, plan: SprintPlan }
```

`getAcceptedPlan(projectId)` / `saveAcceptedPlan(projectId, record)` /
`clearAcceptedPlan(projectId)` — all wrapped in try/catch (storage may be
disabled / full). Other tabs (e.g. Overview "Plan vs Actual") can read the same
record later without a backend change.

### `PlansView` behaviour

- **Mode toggle** in the header: `AI generate` | `Manual entry`.
- **AI generate:** brief form → `generatePlan()` → the result opens in the
  **editable** `PlanEditor` (not read-only). Action bar: **Accept plan**
  (writes the record, `source:'ai'`), **Regenerate** (re-POST last input),
  **Reset edits** (revert to the generated version; enabled only when edited),
  **Close**. An "Edited — differs from the generated plan" note shows when dirty.
- **Manual entry:** **Start blank plan** (one empty sprint/task skeleton) or
  **Start from last AI plan** (clones the newest saved plan for editing, no AI
  call). Accepting writes the record with `source:'manual'` (no `planId`).
- **Accepted banner** (top of the tab, both modes) when a record exists:
  plan name · source · date, with **View / edit** (reloads it into the editor)
  and **Discard** (`clearAcceptedPlan`). The **Accept** button reads "Accepted"
  and is disabled while the draft already equals the stored record.
- **Previous plans** list (server, `GET /v1/plans?project_id=`) still loads any
  saved AI plan into the editor.
- Plan name is required to accept.

### Still deferred

Server-side plan status, a manual-create route, and `POST /v1/plans/:id/apply`
(materialise into real `sprints` + `work_items`). When those land, swap the
`localStorage` store for real calls — `PlansView` keeps the same shape.
