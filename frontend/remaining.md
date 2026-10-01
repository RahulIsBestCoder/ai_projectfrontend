# Remaining Backend Requirements — to Complete Remaining Sections

> Frontend: `raw-test` — AI Project Intelligence Platform (React 19 + Vite, frontend-only).
> Companion to [`lfeatureReportist.md`](lfeatureReportist.md) (side-nav audit) and [`backend requirement .md`](backend%20requirement%20.md) (template).
> Purpose: tell the **backend team** for each section — (a) what the section does, (b) what frontend CAN do today, (c) what it CANNOT do, (d) exact API(s) needed.
> Base URL: `http://localhost:3000/v1` (`VITE_API_BASE_URL`, must end in `/v1`).
> ✅ **Verified 2026-09-14 against backend source** (`/home/developer/Downloads/package/src`) — see [`intplan.md`](intplan.md):
> 26 "Backend needed" items → **~6 already EXIST** in backend code, **~20 still MISSING**. Sections marked 🆕 reflect the verification.

## 0. Global conventions backend MUST follow (applies to all new routes)

- **Envelope:** `{ action_status: true, response: { dataset: <payload> } }` on success; frontend `lib/api/http.ts` unwraps `response.dataset` onto `res.data`. Lists: bare array OR `{ rows, count, page, limit, total_pages }` (`rowsOf()` handles both). Single reads: object OR `[object]`; `[]`/`{}` means null (`oneOf()`).
- **Casing:** backend uses `snake_case` + `_id`; frontend converts via `toApi/fromApi`. New fields MUST be snake_case (e.g. `project_id`, `artifact_url`, `is_active`).
- **Auth:** Bearer `aipi_access`, refresh via `POST /user/regenerateToken` on 401. New routes should accept the same header (plans routes are currently open — see §4).
- **Errors:** `{ message, code? }` + `action_status:false` throws `ApiError.msg` shown in toast. Never return 304 with empty body for execution (frontend treats it as null).
- **Timeouts:** AI/sync routes can run 5–90s; allow long handlers. Frontend uses 60s (sync), 120s (plan generate, risk analyze, context rebuild).

## 1. Auth — LoginView (gate, no side-nav)

**Section summary:** 2-step login + forgot/OTP/reset. Blocks entire app until `aipi_access` stored; 401 bounces to login.
**CAN do:** `POST /user/login {email,password,login_type:1}` → `{authorization_code}`; `POST /user/generateToken {authorization_code}` → `{access_token,refresh_token}`; `POST /user/forgotPassword {email}`, `/user/verifyOtp {email,otp}`, `/user/resetPassword {email,password,confirm_password}`. All wired with seed logins.
**CANNOT do:** know WHO logged in — `generateToken` returns no `user` object, so frontend fakes `currentUser.id` and derives `owner_id` for Create Project from an existing project. Fails on empty DB. No signup.
**Backend needed (P0):**
| Method + Path | Req | Res dataset | Why |
|---|---|---|---|
| `POST /v1/user/generateToken` (extend) | same | add `user: {_id,email,first_name,last_name,role,organization_id}` | unblocks owner/org prefill, RBAC, audit |

## 2. Projects — Portfolio (tab `portfolio`)

**Section summary:** Landing page: org portfolio stats, project cards with health gauge, Create Project modal, Open → workspace.
**CAN do (🆕 verified):** `GET /v1/projects` list — already returns `{rows,count,page,limit,total_pages,total}` and supports `page`/`limit` (intplan §A·§2); `POST /v1/projects {name,organization_id,owner_id,status(1-5 number)}` create; `GET /:id`, `PUT /:id`, `DELETE /:id` all mounted. Helpers `updateProject/deleteProject` already coded in `lib/api/projects.ts` (FE just not wired).
**CANNOT do:** `search` / `status` / `sort` query params; edit/delete from UI (needs small FE wiring now that PUT/DELETE exist).
**Backend needed (P2):**
| Method + Path | Req | Res | Why |
|---|---|---|---|
| `GET /v1/projects?search=&status=&sort=` — add params to the existing paged list | query | existing `{rows,count,...}` envelope | portfolio grows; client filter won't scale |

## 3. Reports (tab `reports`, needs project)

**Section summary:** Per-project report register: list, create (name+type+period+format), download PDF, delete. No server-side generation today.
**CAN do:** `POST /v1/reports {project_id,name,definition:{type,period},format,status?}`, `GET /v1/reports?project_id=&limit=&page=`, `GET /:id`, `PUT /:id {name|definition|format|status|artifact_url}`, `DELETE /:id` (soft). Download fetches `artifact_url` else generates styled PDF in-browser. Types health_check/risk_assessment/progress_report/sprint_review; periods weekly/monthly/sprint; formats pdf/html/ppt.
**CANNOT do:** generate server-side, check status, export csv/xlsx, or email — all 404, buttons removed.
**Backend needed (P1):** `POST /v1/reports/:id/generate {}` -> {id,status}; `GET /v1/reports/:id/status` -> {status,progress_pct?,error?}; `GET /v1/reports/:id/export/:fmt` (pdf|csv|xlsx|html) -> binary; `POST /v1/reports/:id/send {to[],subject?,body?}` -> {queued:true}.

## 4. Plan — AI Sprint Planner (tab `plan`, needs project)

**Section summary:** AI-brief form -> sync AI plan (5-25s) -> editable draft (sprints/tasks/milestones/deadlines/risks/assumptions) -> Accept -> checklist in Execution. Manual blank/last-AI supported.
**CAN do:** `POST /v1/plans {description*,project_name?,project_id?,team_size?,duration_weeks?,sprint_length_weeks?,start_date?,constraints[]}` -> {id,generated_by,model,input,plan} (120s+Cancel); `GET /v1/plans?project_id=`; `GET /v1/plans/:id`; `POST /v1/plans/:id/accept` (+?resync=true) -> {planId,status,itemsCreated}; `GET /:id/execution` -> {plan,progress,sprints,milestones,deadlines}; `PATCH /:id/execution/:kind/:itemId {is_completed}`. 🆕 Plan model now has `status` field (`default:'draft'`) but **no `acceptedAt`** (intplan §A·§4). Hide/accepted record still in localStorage.
**CANNOT do:** persist edits, delete, status draft/accepted, paging/sort, auth, or materialise into real sprints+work_items.
**Backend needed (P0):** `PUT /v1/plans/:id` (partial SprintPlan) -> updated; `DELETE /v1/plans/:id` -> {deleted:true}; `GET /v1/plans?project_id=&page=&limit=&sort=-createdAt` -> {rows,count}; `POST /v1/plans/:id/apply` -> {sprintsCreated,workItemsCreated}; set `status` server-side on accept ('accepted') + add `acceptedAt`; optional auth (frontend already sends Bearer).

## 5. Integrations + Sync (tab `integrations`; Navbar quick-sync)

**Section summary:** Link GitHub/Taiga to project, edit creds, Sync now, history, workspace table in Settings.
**CAN do:** `POST /v1/integrations {project_id,provider,repository_name,repository_url?,username?,password?,token?,category?,status:1}`; `GET /:id`; `PUT /:id`; `DELETE` soft (re-link revives); `GET /v1/projects/:id/integrations`; `GET /v1/integrations/:id/sync-history`; `POST /v1/integrations/:id/sync` (60s) GitHub works; 🆕 `GET /v1/integrations/:id/taiga-tasks` mounted. Categories ui/backend/apps/shared/other.
**CANNOT do (frontend-only — backend is ready):**
- 🆕 **Global sync route EXISTS** — `POST /v1/projects/:projectId/sync` (`project_controller.syncProject`, fan-out of every integration, optional `{integration_id}` body). FE `triggerSync()` in `lib/api/integrations.ts` still **throws client-side** — Navbar button fails until wired (intplan §F1).
- 🆕 **Taiga auto-token EXISTS** — `integration_service.authenticateTaiga` exchanges username/password → cached `auth_token` (creds supersede cache). FE still pushes `TAIGA_TOKEN_REQUIRED` and demands a manual token — needs softening (intplan §F1).
- Server provider list still missing (static github/taiga catalog); OAuth still not built.
**Backend needed (P2):** `GET /v1/integrations/providers` -> [{id,name,type}]; later OAuth connect/disconnect.

## 6. Execution sub-sections (tab `execution`)

**Section summary:** Composed page: 6.1 accepted-plan checklist, 6.2 current sprint charts, 6.3 sprint comparison, 6.4 work-items Kanban, 6.5 GitHub activity. All render; one save missing.
**CAN do:** plan execution CRUD above; `GET /v1/projects/:id/sprints` (+active_sprint), `/sprints/:id/burndown|burnup|velocity|summary|comparison|retrospective`, `/projects/:id/work-items` (+PUT /work-items/:id {status|assignee_id|priority}), `GET /v1/projects/:id/repositories`. 🆕 `GET /:id/git/{commits,pull-requests,contributors,metrics,activity}` **ALL MOUNTED**; 🆕 `POST /sprints` + `PUT|DELETE /sprints/:id` mounted. Work-items falls back to plan-execution tasks when empty.
**CANNOT do:** (a) save retrospective notes — `ISprintUpdate` has **no `retrospective_notes` field** (this is now the only missing sprint route); (b) populate the GitHub feeds in the UI — FE still probes with the empty-feed fallback, needs wiring now that routes exist (intplan §F1); (c) create sprints from UI (needed later by the plan `apply` flow).
**Backend needed (P1):** add `retrospective_notes` to `PUT /v1/sprints/:id` (and return it in the summary / `GET /sprints/:id/retrospective`).

## 7. Health + Departments + AI (tabs `health`, `departments`, `ai`, `overview`)

**Section summary:** Health = components/trend + DORA + risk/forecast/deadline. Departments = org gauges + comparison. AI Assistant = what-if simulator + grounded Q&A. Overview = header + latency/churn/velocity/risks cards. All read live data; gaps are missing server aggregates, not missing UI.
**CAN do:** `GET /:id/health, /health/strategies, PUT /health/strategy {strategy_id}, /analytics/trends?metric=health&period=daily&days=56, /git/metrics (DORA), /git/activity, /departments?organization_id=, /departments/:id/metrics, /:id/risks + POST /:id/risks/analyze (120s) + POST /:id/predictions/deadline {target_date} + GET /:id/predictions/completion (p50/p80/p95), POST /v1/ai/chat {prompt,project_id}, GET+POST /v1/ai/projects/:id/ai/context` (120s rebuild), `GET /v1/ai/providers + /ai/models`, `POST /projects/:id/ai/summary|recommendations`. Analytics bundle zero-fills PR/churn/velocity so Overview derives them from raw commits/PRs/sprints.
**CANNOT do:** show real PR/churn/velocity inside the analytics bundle (always 0 — frontend works around it); switch AI model server-side (client-side `aipi_model:<PROVIDER>` pref only); read real feature flags (`GET /v1/feature-flags` unmounted → derived flags); answer richly on fresh projects (no analytics/risk rows → generic AI).
**Backend needed (P1/P2):** fill analytics bundle `{health,progress,velocity,quality,risk}` with real `prMetrics/codeChurn/bugMetrics/qaCapacity` (or add `GET /:id/analytics/full`); add model-switch e.g. `POST /v1/ai/providers/:type/model {model}` (or honour `model` on switch); add `GET /v1/feature-flags` -> [{key,value,description}] (frontend already handles it — lights up with no FE change); seed analytics+risk rows for new projects (or return helpful empty hint for AI grounding).

## 8. Settings + Admin + Notifications (tab `settings`; orphaned Admin/Notifications)

**Section summary:** Settings page works (provider switch, model pref client-side, derived flags, workspace integrations table). AdminView (org settings/members/departments/teams/employees) and NotificationsView (feed + prefs + test) are fully coded but NOT routed — no nav item mounts them.
**CAN do (Settings):** `GET /v1/ai/providers` switch via `POST /v1/ai/providers/switch` (confirmed mounted, intplan §A), `GET /v1/ai/models`; workspace list fans out `GET /projects/:id/integrations`. 🆕 Per intplan §A·§8: org create (`POST /organizations...`), notifications create/list, `GET /departments`, dept metrics, work-items etc. are mounted. **Coded-but-unreachable (still MISSING):** `GET|PUT /v1/organizations/:id/settings`, `GET|POST /v1/organizations/:id/members`, `DELETE /:id/members/:userId`, `PUT|DELETE /v1/departments/:id`, teams (`GET|POST /v1/teams`, `DELETE /v1/teams/:id`), employees (`GET /v1/employees`), notification lifecycle (`PATCH /v1/notifications/:id/read`, `PATCH /v1/notifications/read-all`, `GET|PUT /v1/notification-preferences`, `POST /v1/notifications/test {type}`).
**CANNOT do:** reach Admin/Notifications from UI (frontend one-line change once backend confirms); enforce RBAC (role switcher is local only; roles super_admin/org_admin/project_manager/member/viewer exist in AdminView).
**Backend needed (P1):** build the missing admin + notification-lifecycle routes above with envelope shapes (members {rows with role}, teams {id,name,description,memberIds}, employees {id,fullName,email,designation,role}, notifications {id,type,title,body,payload,read_at,created_at}, prefs [{eventType,inApp,email}]); add role guard (403 on member write) so FE RBAC switcher can become real; emit notifications on risk_alert/deadline_slip/sync_failed/sprint_closeout/report_ready (FE already renders all 7 types).

## 9. Priority order (refreshed — verified against backend code via intplan.md)

Scoreboard (see [`intplan.md`](intplan.md)): **26 items → ~6 already EXIST in backend, ~20 MISSING.**
- ✅ **Done backend-side (FE can wire NOW — intplan §F1):** project `page/limit` + PUT/DELETE; sprint `POST` / `PUT` / `DELETE`; git commit/PR/contributor list routes; global `POST /projects/:id/sync`; Taiga username/password → token auto-exchange.
- ❌ **Missing (build):** see below.

**P0 (blocks core loop):** §1 generateToken+user; §4 plans PUT/DELETE/apply/acceptedAt/auth.
**P1 (most visible gaps):** §3 reports generate/status/export/send (4 routes); §6 retro `retrospective_notes` on `PUT /sprints/:id`; §7 analytics bundle real PR/churn/velocity + model-switch + `GET /feature-flags` + fresh-project seeding; §8 admin/notification-lifecycle routes + RBAC 403 + event emission.
**P2 (scale/polish):** §2 project `search/status/sort` params; §5 providers catalog + OAuth; plan auth.

**Frontend split (intplan §F1–F3):**
- **F1 — wire NOW (backend already ships):** `triggerSync()` → `POST /projects/:projectId/sync` (Navbar quick-sync); populate GitHub feeds from the now-mounted git routes (drop empty-feed fallback); send Taiga `username/password` on connect + soften `TAIGA_TOKEN_REQUIRED`; expose "create sprint" (`POST /sprints`); move portfolio list to server `page/limit`.
- **F2 — after backend confirms:** retro save, report Generate/Status/Export/Send buttons, auth `user` from generateToken, plans server-status instead of localStorage, Admin/Notifications nav, Projects edit/delete.
- **F3 — no FE change (auto lights up):** `GET /v1/feature-flags`, providers catalog, model-switch, git feed routes (all coded with graceful fallback).

Orphan decision (FE-only): expose Admin + Notifications in nav; delete TaigaTracking + SettingsModal + SyncEngine page.

*End — generated 2026-09-14, refreshed against `intplan.md` backend audit (2026-09-14): sync, Taiga auto-token, git routes, sprint CRUD, project paging moved from MISSING → EXIST.*

