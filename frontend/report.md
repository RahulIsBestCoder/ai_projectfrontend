# Frontend Technical Review — AI Project Intelligence Platform

**Date:** 2026-09-19
**Scope:** The whole repository (`src/`, `components/`, `lib/`, `types/`, `hooks/`, configs and planning docs). The backend source was not available, so every backend claim comes from the in-repo docs (`intplan.md`, `remaining.md`, `spec_ai_generate.md`, `docs/`) and is marked **NEEDS VERIFICATION** where it matters.
**Method:** Every file was read in full. I traced each feature from the component to the endpoint, and ran the typecheck, lint and production build.
**Git:** The folder is **not a git repository**, so there is no diff to review. §5 covers the project's state instead of "recent changes".

---

## Executive summary

The app is a working, feature-rich React 19 + Vite dashboard. All 10 visible nav sections call a real backend, and nothing renders HTML unsafely. It is **not production-ready**, for five reasons:

1. **Wrong data shown as real data.**
   - Switching project can show project A's analytics, reports and plan under project B, because several requests have no cancellation.
   - Several "AI" metrics are computed in the browser from fixed tables or zero-fills.
   - Every work item shows as type FEATURE because of an enum-mapping bug.
2. **Errors look like "no data".** `safeRead` turns every failed read (401, 500, network) into an empty result. Users cannot tell an outage from an empty project.
3. **Security and auth gaps.**
   - Admin seed credentials are pre-filled in the production bundle.
   - Stored integration tokens are returned to the browser and can be revealed.
   - Sign-out leaves the previous user's data behind.
   - The organization ID is hard-coded.
4. **Quality gates are red.** `tsc` fails with 2 errors, ESLint reports 14 errors, there are **zero tests**, the JS bundle is a single 1 MB chunk, and there is no CI.
5. **Architecture strain.**
   - `App.tsx` is the only data hub, with 20+ `useState` and no router.
   - The same endpoints are fetched 2–5 times per tab.
   - `PlansView.tsx` is 1,676 lines.
   - About 2,300 lines of dead components and helpers remain.

None of these need a rewrite. Items P0–P2 in §14 are targeted fixes.

### Build and quality gates (run 2026-09-19)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ❌ **2 errors**: `lib/api/ai.ts:39,47` (implicit `any` on `m`) |
| `npx vite build` | ✅ passes (Vite does not typecheck), but ⚠️ **one 1,008 kB JS chunk** (277 kB gzipped) |
| `npx eslint .` | ❌ **14 errors, 2 warnings**. Mostly `react-hooks/set-state-in-effect`, plus `react-hooks/purity` (`Date.now()` in render, `OverviewDashboard.tsx:118`) and `exhaustive-deps` (`AdminView.tsx:250`) |
| Tests | ❌ **None**: no test runner, no test files |
| CI/CD, Docker | ❌ None in the repo |

---

## 1. Project overview

**AI Project Intelligence Platform** is an engineering-delivery analytics tool for project managers, tech leads and engineering managers. The user flow:

- The user writes a project brief, and an LLM (Gemini, or Ollama/Grok) drafts a sprint plan with tasks, milestones, deadlines and risks.
- The user edits and accepts the plan, then optionally publishes it to Taiga.
- The user connects GitHub and Taiga to the project, and the backend syncs commits, PRs and stories.
- The platform then reports **whether real delivery is tracking the plan**: health score, DORA-style metrics, risk analysis, Monte-Carlo completion forecast, deadline prediction, department health and AI reports.
- An AI assistant answers questions grounded in project context.

This repo is **frontend only**. The backend is a separate Node/Express/MongoDB service with a `{response:{status,dataset}}` envelope and snake_case fields.

## 2. User flows

```
Login (2-step: /user/login → /user/generateToken)  ─┬─ Forgot → OTP → Reset password
                                                    ▼
Projects (Portfolio: cards, health gauge, forecast, Create Project)
        │  "Open"
        ▼
Overview ──► Plan (brief → AI generate → edit → Accept → Publish to Taiga)
        │          │
        │          ▼
        │     Execution (accepted-plan checklist · sprint charts · sprint comparison
        │                · work-item Kanban · GitHub activity)
        ├──► Health (health score/strategy · AI assessment · risks · deadline prediction)
        ├──► Departments (org gauges, department drill-down)
        ├──► AI Assistant (prediction/XAI card · what-if simulator · grounded chat · context)
        ├──► Reports (AI project report → view → download PDF)
        └──► Integrations (connect GitHub/Taiga, credentials, sync, history)
Settings (AI provider + model, workspace integrations)
Navbar: project selector · "15-Min Sync" · "AI Sync" · role switcher · sign-out
```

## 3. Frontend architecture

```
index.html → src/main.tsx → <App/>  (src/App.tsx, 565 lines — auth gate + "router" + data hub)
   ├─ authed? no → LoginView
   ├─ Navbar, Sidebar  (activeTab: TabType state — no URL routing)
   └─ <main key={dataVersion}>  → one of 10 tab views, chosen by activeTab
        ├─ Views receive shared data as props (analytics, prediction, git data, sprints, forecast)
        └─ …and ALSO fetch their own data in useEffect (duplicates, see §7)
lib/api/*.ts  (22 service modules, barrel in index.ts)
   └─ http.ts: axios instance → Bearer from localStorage → envelope unwrap → 401 refresh once
      case.ts: snake⇄camel conversion · util.ts: rowsOf/oneOf/safeRead/unwrap · enums.ts
types/index.ts (765 lines, all shared interfaces)
```

| Concern | Current approach | Assessment |
|---|---|---|
| Routing | `activeTab` state in App | No deep links; refresh always lands on Portfolio; no browser back/forward; no 404 page |
| Server state | Hand-written `useEffect` + `useState` in App and in each view | No cache, no dedupe, no cancellation → races and duplicate requests (§7) |
| Global state | Props from App (no Context, no Redux) | Acceptable at this size, but App holds 20+ pieces of state |
| API layer | One axios instance plus per-domain adapters | **Good foundation**: consistent envelope handling, token refresh with a single in-flight promise |
| Styling | Tailwind v4, custom "brutalist" look (border-2, mono uppercase) | Consistent; no shared Button/Input/Modal primitives, so classes are repeated |
| Forms | Hand-rolled `useState` per field | `zod` and `@hookform/resolvers` are installed but unused; there is no `react-hook-form` |
| Structure | Flat `components/` at the repo root (not in `src/`), `@` → repo root | Workable; no feature folders |

**Dependency hygiene:** `next`, `mongodb`, `@google/genai`, `motion`, `zod`, `@hookform/resolvers`, `class-variance-authority`, `firebase-tools` and `eslint-config-next` are **vestigial or unused** by the code. `mongodb` in a browser app's dependencies is a red flag. ESLint runs through the Next config, and 31 files carry a pointless `'use client'`. `index.html` and `vite.config.ts` polyfill `global`/`process`, probably for these packages.

## 4. Current implementation status

Status is based on the code, not on `lfeatureReportist.md`. That doc marks most sections "COMPLETED ~90–100%", which overstates it given the findings below.

| Feature | Status | Why |
|---|---|---|
| Login / forgot / OTP / reset | **NEEDS REVIEW** | Works. Admin credentials pre-filled; no `/me`, so the user is unknown after reload; reset sends `confirm_password = password` |
| Session / 401 handling | **NEEDS REVIEW** | Refresh works; a 401 without a refresh token is swallowed and never bounces to login |
| Portfolio + Create Project | **IN PROGRESS** | Works; capped at 100 projects; edit/delete not wired (backend routes exist); failure shows "No projects yet" |
| Overview | **NEEDS REVIEW** | Renders; several metrics zero-filled or browser-derived (§8); stale data on project switch |
| Plan (AI generate/edit/accept) | **NEEDS REVIEW / NEEDS BACKEND CHANGE** | Works end to end, but the accepted plan lives in localStorage **and** on the server, and they diverge. No `PUT/DELETE /plans`. Generation that is still running lands in the wrong project |
| Execution (checklist, sprints, Kanban, GitHub) | **NEEDS REVIEW** | Endless spinner when there are no sprints; wrong work-item type; fake priority; Kanban falls back to plan tasks and PUTs the wrong resource |
| Health / Risk / Deadline | **NEEDS REVIEW** | Well structured (`Health.tsx` is the best-built view); risk "AI" delay comes from a fixed table |
| Departments | **IMPLEMENTED (needs QA)** | Works; "active" count can exceed total employees |
| AI Assistant | **NEEDS REVIEW** | Chat works; the **what-if simulator is a no-op**; chat carries over between projects |
| Reports | **NEEDS REVIEW** | Generate/download work; the previous project's report stays visible and downloadable after a switch |
| Integrations | **NEEDS REVIEW (security)** | Works; stored tokens are revealable; Taiga auto-token not wired on the frontend |
| Navbar "15-Min Sync" | **BLOCKED (frontend)** | `triggerSync()` always throws, yet `POST /projects/:id/sync` exists per `intplan.md` and is used in `portfolio.ts` |
| Role switcher / RBAC | **NOT STARTED (cosmetic only)** | Anyone can pick ADMIN; nothing reads the role |
| Settings (provider/model) | **IMPLEMENTED (needs QA)** | Model preference is in localStorage but is sent with chat |
| Admin, Notifications | **NOT STARTED (UI orphaned) / NEEDS BACKEND CHANGE** | Fully coded, never mounted; many backend routes missing |
| Tests, CI, deploy | **NOT STARTED** | |

## 5. Recent change analysis

There is no git history, so the actual recent diffs cannot be reviewed. The in-repo docs (`remaining.md`, `intplan.md`, dated 2026-09-14) describe the latest known state. Areas that still differ from those docs:

| Area | Doc says | Code does | Risk |
|---|---|---|---|
| Global sync (`intplan §F1`) | Frontend should wire `POST /projects/:id/sync` | `triggerSync` still throws (`lib/api/integrations.ts:236`) | Navbar button always errors |
| Taiga auto-token (`§F1`) | Backend exchanges username/password | UI now hints "optional — auto-obtained" | Probably done; **NEEDS QA** |
| Plans header comment | — | `plans.ts:18-23` says "only three routes exist", but the file calls 10+ | Misleading to maintainers |
| README | Refers to `history.md`, `frontend-plan.md`, `_backup/`, `.env.example` | **None of these exist** | Onboarding friction; README §4 `cp .env.example` fails |

**Recommendation:** run `git init` (or restore the real repo) before the next change, so reviews can be diff-based.

## 6. Component review

**Oversized components (split recommended):**

| File | Lines | Problem | Suggested split |
|---|---|---|---|
| `components/PlansView.tsx` | 1,676 | 33 `useState`, 4 effects, 9 services, 5 jobs, 8 sub-components in one file | `PlanBriefForm`; hooks `usePlanGeneration(projectId)` (abort + cleanup), `usePlanDraft`, `useAcceptedPlan`, `useTaigaPublish`; `PlanHistoryList`; `PlanEditor/*` in its own files; `diffPlan` → `lib/planDiff.ts`. Mount with `key={projectId}` |
| `components/IntegrationsView.tsx` | 931 | About 25 `useState`; wizard, row editors and history in one component | `useProjectIntegrations`, `ConnectWizard` (a real `<form>`, reset on close), `IntegrationRow`, `GithubDetailsEditor`, `TaigaCredsEditor`, `SyncHistoryPanel` |
| `src/App.tsx` | 565 | Auth gate, routing, data hub, toasts and provider logic | Router + `AuthProvider` + per-view data hooks (see §7) |
| `components/AiIntelligence.tsx` | 563 | Prediction card, simulator and chat are unrelated | Extract `AiChat` keyed by `projectId` |

**Well-built reference:** `components/project/Health.tsx` uses a discriminated-union state, `aria-live` and is keyed per project. Use it as the pattern.

**Dead code (zero importers):**
- Components: `AdminView` (440 lines), `NotificationsView` (219), `SettingsModal` (132, with fake "acme-software-labs" / "GEMINI_API_KEY Configured" text), `SyncEngine` (95), `TaigaPreviewModal` (246), `TaigaRoleMapping` (119), `TaigaTracking` (259), `hooks/use-mobile.ts`.
- `lib/reportExport.ts` + `lib/reportPdf.ts` (~885 lines, including a `SAMPLE_SUMMARY` fake-data fallback), `buildSimplePdf`.
- About 33 unused `lib/api` exports.

Decide per item: mount it (Admin/Notifications, once the backend exists) or delete it. `remaining.md` already proposes deleting TaigaTracking, SettingsModal and SyncEngine.

**Duplication:**
- Response unwrap helpers overlap: `unwrap` / `rowsOf` / `oneOf` / `seriesOf`.
- Error-swallow wrappers overlap: `safeRead` / `safeOne` / `settled`.
- 3 health fetchers, 2 project-list fetchers, 3 sync functions.
- `ROLE_FROM_BACKEND` in App duplicates `ENUM.role.fromApi`.
- Probability 0–1 vs 0–100 normalization is written 3 times.
- **Inconsistent health bands:** 70/40 on Overview, 80/60 on Health, 50/70 on the badge. The same score reads "Average" on one screen and "At risk" on another. Centralize it in one util.

**Shared-component risk:** there are no shared UI primitives, so no shared-component regression risk today. The cost is repeated Tailwind strings and inconsistent a11y. A small `Button`/`Modal`/`Field`/`EmptyState`/`ErrorState` set would pay off quickly.

## 7. State management review

| Issue | Evidence | Severity |
|---|---|---|
| **Project-switch race in the data hub.** The setters in `loadProjectData` are not guarded by the effect's `alive` flag, so a slow response for project A overwrites project B's state, and `projectDataLoadedFor` is then set to B | `src/App.tsx:162-180` vs `229-234` | **HIGH** |
| **Stale data on project switch.** Only Overview waits for `projectDataLoadedFor`. Execution and AI show the previous project's repos, commits and analytics until the fetch lands | `App.tsx:440, 481-518` | **HIGH** |
| **Views not keyed by project keep old state.** PlansView (generation still running, `lastInput`), ReportsView (`generatedReport`/`activeReport` never reset, so the old report can be downloaded), AiIntelligence (chat history sent into the new project's prompt), GithubAnalytics (`selectedRepoId` persists, filters to nothing) | `PlansView.tsx:268-280`, `ReportsView.tsx:45-65`, `GithubAnalytics.tsx:42-51` | **HIGH** |
| **Duplicate fetching.** `Collapsible` keeps hidden children mounted, so every section fetches on tab open. `/projects/:id/sprints` is fetched about 5× on Execution; `/health` and `/predictions/completion` 2× on Overview/Health; `listPlans` on every chat message | `Collapsible.tsx`, `sprints.ts` (`listSprints` + `getActiveSprint`, same URL) | MEDIUM |
| **`key={dataVersion}` remount after AI Sync.** It discards chat, form input and a running AI assessment, and refetches what `refreshData` just loaded | `App.tsx:412` | MEDIUM |
| **Two sources of truth for the accepted plan.** PlansView reads localStorage; Execution reads server `status==='accepted'`. Manual plans never reach Execution; edits never reach the server or Taiga; a failed accept still shows "accepted" locally | `PlansView.tsx:464-475, 571`, `Execution.tsx:51-57`, `lib/acceptedPlan.ts` | **HIGH** |
| localStorage keys (`aipi_plan*`, `aipi_model:*`) are per project, not per user, and are never cleared | `lib/acceptedPlan.ts`, `lib/planDraft.ts`, `lib/api/ai.ts` | MEDIUM |

**Recommendation:**
- Adopt **TanStack Query** keyed by `['project', projectId, resource]`. This one change fixes the race, the stale data, the duplicate requests, the blunt remount (replace it with `invalidateQueries`), and the missing error states in §9. It is justified here, not added for its own sake.
- Keep auth and the selected project in a small Context.
- Put `projectId` and the tab in the URL (React Router) for deep links and refresh.
- Short term, without a new dependency: add a per-request project check in `loadProjectData`, and use `key={selectedProjectId}` on every project-scoped view.

## 8. Frontend/backend contract check

**1. Work items: type is always FEATURE (HIGH, verified)**
- Endpoint: `GET /projects/:id/work-items`
- Frontend: `mapEnum(ENUM.workItemType.fromApi, item.type?.toUpperCase(), 'FEATURE')` (`lib/api/workItems.ts:25`).
- Backend provides lowercase `story|task|bug|epic|subtask`, and the table keys are also lowercase, so the upper-cased lookup always misses.
- Impact: every item, bugs included, shows as FEATURE.
- Action: drop the `.toUpperCase()`.

**2. AI prediction delay is fabricated (HIGH, verified)**
- Endpoints: `POST /projects/:id/risks/analyze` + `GET /predictions`
- Frontend: `runAIPrediction` derives `delayProbability` and the XAI "weights" from a fixed table `{CRITICAL:88, HIGH:66, MEDIUM:42, LOW:18}` (`lib/api/risk.ts:110-135`). `toPrediction` falls back to `confidence` as delay probability (`risk.ts:18-21`).
- Backend provides risk level and confidence, not a delay probability from this call. **NEEDS VERIFICATION:** whether `/risks/analyze` saves a prediction.
- Impact: numbers shown as "Explainable AI" are not model output.
- Action: **backend change**. Return `delay_probability` and feature importances, or the frontend shows "not available".

**3. Analytics bundle is zero-filled (HIGH)**
- Endpoint: `GET /projects/:id/analytics`
- Frontend: `coerceBundle` fills PR, churn, bug and QA metrics with `0`, derives delay as `100 − health`, and maps code coverage to "QA capacity" (`lib/api/analytics.ts`).
- Backend: zero-fills the bundle (known, `remaining.md §7`).
- Spec: `spec_ai_generate.md` says missing evidence must stay `null`, never `0`.
- Impact: the simulator sliders start at fake zeros; "QA Bottleneck Ratio" is always "—".
- Actions:
  - **Backend change:** fill the bundle, or add `/analytics/full`.
  - **Frontend:** keep `null` and render "not available".

**4. What-if simulator is a no-op (HIGH, verified)**
- Frontend: `handleSimulate` builds a scenario prompt, but `handleRunPrediction(_customPrompt)` ignores it (`src/App.tsx:291`).
- Impact: "Simulate Scenario" returns the same result as "Recalculate".
- Action: pass the scenario to the backend if it supports it (**NEEDS VERIFICATION**); otherwise hide the simulator.

**5. Navbar sync not wired (HIGH, frontend-only)**
- Endpoint: `POST /projects/:projectId/sync`
- Frontend: `triggerSync` throws unconditionally.
- Backend: exists, per `intplan.md` and `portfolio.ts:166`.
- Action: wire it to the existing `syncPortfolioProject` and remove the stub.

**6. 403 message overwritten (HIGH, verified)**
- Endpoint: all endpoints
- Frontend: every 403 becomes "You do not have access to sync this project" (`lib/api/http.ts:122-123`), discarding the server `msg`.
- Action: use `env?.status?.msg`, with a generic fallback: "You don't have permission to do this."

**7. Token generation returns no user (MEDIUM, needs backend change)**
- Endpoint: `POST /user/generateToken`
- Frontend expects `user {_id, email, role, organization_id}`; backend provides tokens only.
- Impact: role, owner and org are unknown, which leads to the hard-coded org ID and `owner_id` taken from another project.
- Action: backend adds `user` (already P0 in `remaining.md §1`), or adds `GET /user/me`. The frontend must also `fromApi` it (`_id` → `id`).

**8. Completion forecast may always be null (MEDIUM, NEEDS VERIFICATION)**
- Endpoint: `GET /projects/:id/predictions/completion`
- Frontend expects top-level `p50` (`risk.ts:263-265`).
- Spec (`spec_ai_generate.md:325-330`) and `portfolio.ts` read `forecast.p50`, nested.
- Impact: Overview and Risk forecast render as empty.
- Action: confirm the payload, then unify on one `CompletionForecast` type.

**9. AI assessment request body (MEDIUM)**
- Endpoint: `POST /projects/:id/ai-assessment/refresh`
- Frontend sends `{sync:false}` only (`analytics.ts:135`).
- Spec requires `{sync:true, provider, model}`.
- Action: align with the spec, or update the spec.

**10. Project status enum mismatch (MEDIUM)**
- Endpoint: `POST/PUT /projects`, `status`
- Frontend writes AT_RISK and DELAYED as `2` (on_hold); reads handle strings only.
- Backend uses numeric status 1–5.
- Impact: delivery health is mixed into lifecycle status; numeric statuses always read as ON_TRACK.
- Action: separate lifecycle status from delivery health; map numbers on read.

**11. Lossy enum mappings (MEDIUM)**
- Work-item status: `IN_TESTING ↔ blocked`, and `CANCELLED` is missing from the TS union.
- Work-item type: `TECH_DEBT` does not round-trip.
- Role: `ADMIN → super_admin` for org invites, where `org_admin` exists; `viewer → DEVELOPER` loses read-only status.
- Action: agree the enum tables with the backend.

**12. Integration responses include secrets (HIGH, security)**
- Endpoint: `GET /projects/:id/integrations`
- The frontend renders `r.token` with Show/Hide (`IntegrationsView.tsx:813-828`) and types `password` as a response field.
- **BACKEND CHANGE REQUIRED:** return `has_token: bool` and `has_password: bool`, never the values.

**13. Admin and notification routes missing (MEDIUM, needs backend work)**
- Endpoints: org settings and members, teams, employees, `PUT/DELETE /departments`, notification lifecycle, `PUT /health/strategy`.
- Frontend: coded, and reads are wrapped in `safeRead`.
- Backend: MISSING per `intplan.md`.
- Action: wait for the backend; show "not available" rather than empty.

**14. Report artifact URL drops `/v1` (LOW, NEEDS VERIFICATION)**
- Frontend: `new URL(url, API_BASE_URL)` resolves against the origin and drops `/v1` (`reports.ts:124`).
- Only matters if `fetchReportArtifact` is revived; it is currently unused.

**15. Postman sync doc uses an old envelope (LOW)**
- `docs/integration-sync-postman.md` shows the old `{status, data_sets}` envelope.
- The doc is probably stale; update it.

**Case-conversion caveat:** `toApi(fromApi(x)) ≠ x` for keys with digits (`delta_7d`) or acronyms. Low risk, but document it.

## 9. UX review

| State | Finding | Severity |
|---|---|---|
| **Error vs empty** | `safeRead` (about 50 call sites) returns `[]`/`null` on any failure. Screens then show "No projects yet", "No integrations connected", "No accepted plan yet" or "No reports" during an outage. The `catch` in App's project load is dead code. **Fix:** return `{data, error}` (or use React Query's `isError`) and add an `ErrorState` with Retry | **HIGH** |
| Loading | `SprintIntelligence` spins **forever** for a project with no sprints (`loading` starts `true`, and the effect returns early when there is no `sprintId`) | HIGH |
| Crash safety | **No ErrorBoundary.** Unguarded nested reads crash the whole app on unexpected payloads: ReportsView `work.byFeature.map` / `FEATURE_STATUS_STYLE[status].badge`; `SprintComparison` `timeline.map`; `ProjectContextPanel` `snap.sources.map`; `RiskAnalysis` `LEVEL_META[level]` | HIGH |
| Misleading copy | Hard-coded "generated by Gemini 3.6 Flash" whatever the provider (`AiIntelligence.tsx:355`); "Real-time", "Live telemetry from GitHub webhooks" for a one-time fetch; "Review Latency: 0h" on every PR; priority `<select defaultValue="MEDIUM">` shows MEDIUM for every card (`WorkItemsBoard.tsx:189`); "Invalid Date" when there is no finish date; "Trigger 15-Min Data Sync" on Overview only switches tabs | MEDIUM |
| Tech leakage | Empty states show endpoints to users ("GET /projects/:id/analytics returned nothing", App.tsx:460); "check the backend log" on forgot-password | LOW |
| Validation | Plan editor: no end-after-start check, negative and decimal numbers accepted, no `maxLength`. Password reset: no confirm field, no strength rule | MEDIUM |
| Destructive actions | No confirmation on Disconnect integration, Delete report, Discard draft, Close edited plan | MEDIUM |
| Duplicate submit | **Mostly good:** generate, accept, publish, create project, login and provider switch are all guarded. Gaps: Disconnect (double DELETE), `openSaved` in PlansView | LOW |
| Toasts | `showToast` doesn't clear the previous timer, so a newer toast disappears early | LOW |
| Responsive | Below `md`, the sticky Navbar stacks to about 4 rows; the Sidebar becomes a full-width 10-button list with no collapse (`use-mobile.ts` exists but is unused); Integrations row actions (6 controls, `shrink-0`) likely overflow; the Kanban uses HTML5 drag-and-drop, which **does not work on touch** | MEDIUM |
| Accessibility | Create Project and Department modals: no `role="dialog"`, Escape, focus trap or focus return. Many inputs are placeholder-only (Plan editor, Integrations wizard, Navbar selects). Icon-only buttons use `title` only. `focus:outline-none` with no visible replacement (about 23 places). Kanban has no keyboard path. Some charts have no legend (colour only) | MEDIUM |

## 10. Security review

| # | Finding | Severity |
|---|---|---|
| S1 | **Admin seed credentials hard-coded and pre-filled** in the production bundle (`LoginView.tsx:22-23, 204`, seed buttons). Gate them behind `import.meta.env.DEV` | **HIGH** |
| S2 | **Integration tokens (and possibly passwords) returned to the browser** and revealable with Show (`IntegrationsView.tsx:813-828`). The wizard token input is not masked (`:543`). Backend must return booleans only | **HIGH** |
| S3 | **Hard-coded organization** `6aa25d1cb8cdc6b232abe540` (`App.tsx:65-71`). Every user loads that org's projects. Frontend scoping is not security, but this shows multi-tenant scoping is not implemented in the UI. **NEEDS VERIFICATION** that the backend enforces org membership | HIGH |
| S4 | **Sign-out is incomplete.** Only the tokens are removed. `aipi_plan*` / `aipi_model:*` remain, and in-memory state (analytics, commits, `currentUser.id/role`) survives into the next login because App stays mounted. The `auth:unauthorized` path clears nothing | MEDIUM |
| S5 | **401 without a refresh token never logs out** (`http.ts:97` requires `getRefresh()`), and `login()` reports success even when no tokens came back (`auth.ts:38-42`) | MEDIUM |
| S6 | **Password reset** sends `confirm_password = password` and no OTP or token. **NEEDS VERIFICATION** that the backend binds the reset to the verified OTP; if not, this is an account-takeover risk | MEDIUM (possibly CRITICAL) |
| S7 | Access and refresh tokens are in `localStorage`, readable by any XSS. This is an accepted trade-off only while there is no XSS surface; consider httpOnly cookies later | MEDIUM |
| S8 | Role switcher lets anyone select ADMIN. It is purely cosmetic today (nothing reads the role), but it implies RBAC exists. The backend must enforce roles | LOW |
| S9 | `test5_logical.json` contains a server stack trace with local paths. `.env` holds backend-only keys (`AI_SYNC_COOLDOWN_MINUTES`); these are not shipped because they lack the `VITE_` prefix, but they belong in the backend. `mongodb` is a dependency of the web app | LOW |
| ✅ | **No XSS surface:** no `dangerouslySetInnerHTML`, `innerHTML`, `document.write` or markdown renderer. AI output is rendered as escaped text. No secrets in `VITE_*` variables; no tokens logged | — |

## 11. Performance review

- **Single 1 MB JS chunk.** There is no code splitting. Lazy-load tabs with `React.lazy` (PlansView, IntegrationsView, Recharts-heavy views) and drop unused dependencies. This is the biggest and cheapest win.
- **Duplicate network requests** (§7): collapsed sections fetch while hidden, and some endpoints are hit 2–5× per tab. Portfolio makes up to 200 extra requests (2 per card, for up to 100 cards; concurrency is limited to 5, which is good).
- **AI Sync double refresh:** `refreshData()` runs, then `<main>` remounts and every view refetches.
- **PlansView** runs `JSON.stringify` on the full plan every keystroke (`dirty`, `acceptedIsCurrent`), and the whole editor re-renders. Fine at today's plan sizes; memoize if plans grow.
- Rendering cost is otherwise low: lists are capped at about 20 rows per repo, and charts use `ResponsiveContainer`. No memoization is needed elsewhere.

## 12. Testing gaps

There are no tests. Add **Vitest + React Testing Library + MSW**, and Playwright for E2E later. Priorities by business risk:

1. **API layer (unit):** `http.ts` envelope unwrap, `action_status:false` → `ApiError`, 401 → refresh → retry, failed refresh → `auth:unauthorized`; `case.ts` round-trip; `enums.ts` mappings (would have caught the FEATURE bug); `rowsOf`/`oneOf`.
2. **Project switching (integration):** switch A→B while A is slow, and assert B's data is shown in Overview, Reports and Plans.
3. **Auth:** login success, login without tokens, session expiry, sign-out clears state and storage.
4. **Plan lifecycle:** generate (success, error, cancel), accept (success and API failure), edit → publish.
5. **Error states:** 500 or network error on each main tab shows an error, not "empty".
6. **Integrations:** connect, sync (409 in progress, 429 cooldown), disconnect.
7. Add `tsc --noEmit` and `eslint` as CI gates; both are red today.

## 13. Blockers and dependencies

**Backend blockers:**
- `generateToken` should return `user` (or add `GET /user/me`). This is P0 and unblocks RBAC, owner, org and the removal of the hard-coded org ID.
- `PUT/DELETE /plans/:id`, server-side `status:'accepted'` with `accepted_at`, and auth on the plans routes. This is P0 and removes the localStorage source of truth.
- Integration list must stop returning `token`/`password`.
- Real `delay_probability` and feature importances; fill the analytics bundle (PR, churn, bug, QA) or keep those fields `null`.
- Reports generate/status/export/send; `retrospective_notes`; admin, teams, employees and notification-lifecycle routes; RBAC 403s. These are P1 per `remaining.md`.
- Confirm the completion-forecast payload shape, and that password reset is bound to the OTP.

**Frontend blockers (no backend needed):**
- `tsc` and ESLint errors.
- Wire `POST /projects/:id/sync`.
- Enum bug, 403 message, project-switch races, `safeRead` error semantics, seed credentials, sign-out cleanup.

**Design clarification:**
- One health band scale.
- Mobile navigation pattern.
- Whether the what-if simulator and role switcher stay.
- Whether Admin/Notifications get nav entries.

**QA:** no QA sign-off is evident. Everything in §4 marked NEEDS REVIEW needs a test pass after the fixes.

**External:** Gemini/Ollama availability; GitHub and Taiga API tokens and rate limits.

## 14. Next development priorities

```
P0  Stabilise & secure (≈1 sprint, frontend-only)
    1. Fix tsc (ai.ts:39,47) + ESLint errors; add CI running tsc + lint + build
    2. Remove pre-filled seed creds (DEV-only); mask token inputs; stop rendering stored tokens
    3. Fix project-switch races: guard loadProjectData; key project views by projectId;
       abort plan generation on switch/unmount
    4. Full sign-out cleanup (state + aipi_* storage); 401-without-refresh → logout
    5. Fix work-item type mapping; 403 message; wire POST /projects/:id/sync
    6. Add an app-level ErrorBoundary; fix the SprintIntelligence endless spinner
        ↓
P1  Truthful data (frontend + backend)
    7. safeRead → {data,error}; ErrorState + Retry on every main tab
    8. Stop presenting fabricated metrics (fixed delay table, confidence-as-delay,
       100−health, 0h latency, fixed MEDIUM priority, "Gemini 3.6 Flash") — show "not available"
       until the backend supplies them; hide or fix the what-if simulator
    9. Backend: generateToken user → remove hard-coded org; plans PUT/DELETE/accepted status
       → single source of truth for accepted plan
        ↓
P2  Architecture
   10. TanStack Query for server state (dedupe, cancel, invalidate instead of remount)
   11. React Router (deep links, refresh, back button); lazy-load tabs (bundle split)
   12. Split PlansView and IntegrationsView; add shared UI primitives (Button/Modal/Field/States)
   13. Tests: API layer → project-switch → auth → plan lifecycle (see §12)
        ↓
P3  Completeness & polish
   14. Mount Admin/Notifications once the backend lands; delete other dead code and unused deps
   15. Mobile nav, modal a11y, labels/focus styles, keyboard Kanban
   16. Real RBAC once the backend enforces roles; README/doc cleanup
```

**Why this order:**
- P0 items are cheap, need no backend, and remove the things that cause **wrong decisions** (wrong-project data, fake numbers presented as real) or **security exposure**.
- P1 needs a few backend changes that unblock several frontend simplifications at once.
- P2 refactors are much safer once tests (step 13) and a single data-fetching pattern exist. The TanStack Query migration also removes most of the P0 race patches, so do the P0 patches minimally.
- P3 is growth work, not correctness work.

## 15. Questions and uncertainties (NEEDS VERIFICATION)

1. Does `/predictions/completion` return `p50` at the top level or under `forecast`?
2. Does the integrations list actually return `token` and `password` values to the client?
3. Is `/user/resetPassword` bound to the verified OTP session?
4. Does the backend enforce org membership and roles on every route, given that the UI hard-codes the org?
5. Does `POST /risks/analyze` persist a prediction, and can the backend supply a real `delay_probability`?
6. Does `/ai/providers/switch` honour `model`? The code comments contradict each other (`ai.ts:94` vs `110-116`).
7. Which envelope does `POST /integrations/:id/sync` use: `response.dataset` or the Postman doc's `data_sets`? Are `itemsSynced` in history rows numbers or objects?
8. Is `intplan.md` (2026-09-14) still current for which admin and notification routes exist?
9. Is the what-if simulator meant to call a real scenario endpoint?
10. Are Admin and Notifications in scope for the next release?
11. Where is the real git repository? Reviews should be diff-based from here on.

---
*Evidence notes: line references were checked for the HIGH items (App.tsx data-hub race, PlansView reset effect, ReportsView effects, `triggerSync` stub, token rendering, work-item enum, `LEVEL_TO_DELAY`, SprintIntelligence spinner, seed credentials, 403 mapping). Other line numbers are approximate; the functions named are exact.*
