# INTPLAN — remaining.md vs Backend Code (`package/`) + Required Frontend Changes

> Source of truth: `remaining.md` (frontend-side audit, 2026-09-14).
> Verified against: backend code in `/home/developer/Downloads/package/src`
> (all routes mounted at `/v1`, see `src/app_routing.ts`).
> Both input docs are frontend-side; this file separates what the backend
> **already has** from what is **still missing**, section by section, so the
> two teams can see exactly what is left. §F lists changes still required
> on the **frontend** (`raw-test/`) side.

## Scoreboard (26 "Backend needed" items in remaining.md)

| # | Section | Needed items | EXISTS in backend | NOT EXISTS |
|---|---------|--------------|-------------------|------------|
| §1 | Auth (generateToken+user) | 1 | 0 | 1 |
| §2 | Projects search/paging | 2 | 1 (PUT/DELETE confirmed; page/limit already shipped) | 1 (search/status/sort params) |
| §3 | Reports generate/status/export/send | 4 | 0 | 4 |
| §4 | Plans PUT/DELETE/apply/status/paging | 5 | 1 (status field in model, `draft` default) | 4 |
| §5 | Providers catalog + project sync + Taiga token | 4 | 2 (project sync, Taiga auto-exchange) | 2 (providers catalog, OAuth) |
| §6 | Retro save + git list routes + keep POST /sprints | 3 | 2 (git list routes, POST /sprints) | 1 (retro save) |
| §7 | Analytics fill + model-switch + feature-flags + seed | 4 | 0 | 4 |
| §8 | Confirm admin/notifications routes + RBAC + events | 3 | 0 | 3 |
| **Total** | | **26** | **~6 ✅** | **~20 ❌** |

Net: **~6 of 26 backend items already exist** in code; **~20 are still missing**.
(Several "CANNOT do" claims in remaining.md are now outdated because the
backend has since shipped the route — flagged with 🆕 below.)

---

## A. ✅ EXISTS in backend code (no backend work needed — frontend can use now)

### §1 Auth — routes mounted (`src/domain/auth/route/auth_routes.ts`, at `/v1/user`)
- `POST /user/login`, `POST /user/generateToken`, `POST /user/regenerateToken`,
  `POST /user/forgotPassword`, `POST /user/verifyOtp`, `POST /user/resetPassword` — all mounted.

### §2 Projects (`src/domain/project/...`, at `/v1/projects`)
- `POST /`, `GET /` (with `page`/`limit`, returns `{rows,count,page,limit,total_pages,total}`),
  `GET /:id`, `PUT /:id`, `DELETE /:id` — all mounted.
- Bonus (not in remaining.md): `GET /:projectId/{members,milestones,dependencies,reports,releases}`.

### §3 Reports — CRUD (`src/domain/reporting/route/reporting_route.ts`, at `/v1/reports`)
- `POST /`, `GET /` (project/status/format filters), `GET /:id`, `PUT /:id`, `DELETE /:id` — all mounted.
- ❌ Only the 4 lifecycle routes (§3 backend-needed) are missing.

### §4 Plans — read/accept/execution (`src/domain/ai_intelligence/...` at `/v1/ai/plans` + `/v1/plans` alias)
- `POST /plans`, `GET /plans?project_id=`, `GET /plans/:id`,
  `POST /plans/:id/accept` (+`?resync=true`), `GET /plans/:id/execution`,
  `PATCH /plans/:id/execution/:kind/:itemId` — all mounted.
- Plan model has `status` field (`default: 'draft'`) — partial, no `acceptedAt`.

### §5 Integrations + Sync — 🆕 two "CANNOT" items are now DONE in backend
- `POST /projects/:projectId/sync` (fan-out sync of every integration on the project) — EXISTS
  (`project_controller.syncProject`).
- Taiga username/password → `auth_token` auto-exchange — EXISTS
  (`integration_service.authenticateTaiga`, cached token; creds supersede cache).
- Also mounted: `POST /integrations`, `GET|PUT|DELETE /integrations/:id`,
  `POST /integrations/:id/sync`, `GET /integrations/:id/sync-history`,
  `GET /integrations/:id/taiga-tasks`, `GET /projects/:id/integrations`.

### §6 Execution — 🆕 git list routes EXIST (remaining.md §6b is outdated)
- `GET /projects/:id/sprints` (+`active_sprint`), `GET /sprints/:id/{summary,burndown,burnup,velocity,comparison,retrospective}`,
  `PUT|DELETE /sprints/:id`, `POST /sprints` — all mounted.
- `GET /projects/:id/work-items`, `PUT /work-items/:id` — mounted.
- `GET /projects/:id/repositories`, `GET /projects/:id/git/{commits,pull-requests,contributors,metrics,activity}` — ALL MOUNTED
  (controllers `getCommitsByProject`, `getPullRequestsByProject`, etc. implemented).
- `GET /projects/:id/retrospective` read-side EXISTS; sprint `summary` returns `retrospective` field.

### §7 Health + Departments + AI (read routes)
- `GET /:id/health`, `GET /:id/health/strategies`, `GET /:id/analytics/trends`,
  `GET /:id/git/metrics`, `GET /:id/git/activity`,
  `GET /departments?organization_id=`, `GET /departments/:id/metrics`,
  `GET /:id/risks`, `POST /:id/risks/analyze`, `POST /:id/predictions/deadline`,
  `GET /:id/predictions/completion`, `POST /ai/chat`, `GET+POST /ai/projects/:id/ai/context`,
  `GET /ai/providers`, `GET /ai/models`, `POST /ai/providers/switch`,
  `POST /projects/:id/ai/{summary,recommendations}` — all mounted.

### §8 Settings + Admin + Notifications (partial)
- Organizations CRUD, `GET /departments`, `GET /departments/:id/metrics`,
  notifications CRUD (`POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`) — mounted.

## B. ❌ NOT EXISTS in backend code (still to build)

### §1 Auth (P0) — 1 item
1. `POST /v1/user/generateToken` returns only `{access_token, refresh_token, refresh_token_expire_timestamp}`
   (`auth_service.ts:222-226`) — **no `user` object**. Needed:
   add `user: {_id,email,first_name,last_name,role,organization_id}`.

### §2 Projects (P2) — 1 item
2. `GET /v1/projects` supports `page/limit/organization_id` only — **no `search=&status=&sort=`** params
   (`project_service.listProjects` filters on `{is_deleted:false}` only).

### §3 Reports (P1) — 4 items
3. `POST /v1/reports/:id/generate {}` → `{id,status}` — MISSING.
4. `GET /v1/reports/:id/status` → `{status,progress_pct?,error?}` — MISSING.
5. `GET /v1/reports/:id/export/:fmt` (pdf|csv|xlsx|html) → binary — MISSING.
6. `POST /v1/reports/:id/send {to[],subject?,body?}` → `{queued:true}` — MISSING.

### §4 Plans (P0) — 4 items
7. `PUT /v1/plans/:id` (partial SprintPlan) — MISSING.
8. `DELETE /v1/plans/:id` → `{deleted:true}` — MISSING.
9. `GET /v1/plans?project_id=&page=&limit=&sort=-createdAt` → `{rows,count}` — paging/sort MISSING
   (`listPlans` takes only `project_id`, returns bare array).
10. `POST /v1/plans/:id/apply` → `{sprintsCreated,workItemsCreated}` (materialise into real sprints+work_items);
    plus `acceptedAt` field and auth on plans routes — MISSING.

### §5 Integrations (P0/P1) — 2 items
11. `GET /v1/integrations/providers` → `[{id,name,type}]` — MISSING (FE list is static github/taiga).
12. OAuth connect/disconnect — MISSING.

### §6 Execution (P1) — 1 item
13. Retrospective SAVE — MISSING: only `GET /sprints/:id/retrospective` exists;
    `ISprintUpdate` has NO `retrospective_notes` field, so `PUT /sprints/:id` cannot persist it.
    Needed: accept `retrospective_notes` in `PUT /sprints/:id` (or add `PUT /sprints/:id/retrospective`).

### §7 Analytics/AI (P1/P2) — 4 items
14. Real `prMetrics/codeChurn/bugMetrics/qaCapacity` in analytics bundle (zero hits in backend code) — MISSING.
15. AI model-switch (`POST /v1/ai/providers/:type/model {model}` or honour `model` on switch) — MISSING.
16. `GET /v1/feature-flags` route — MISSING (only seed scripts reference the `feature_flags` collection).
17. Seed analytics+risk rows for new projects (or empty-hint for AI grounding) — MISSING.
18. (extra) `PUT /health/strategy {strategy_id}` — no strategy write route anywhere — MISSING.

### §8 Admin + Notifications (P1) — 3 items
19. Org admin routes — MISSING: `GET|PUT /organizations/:id/settings`,
    `GET|POST /organizations/:id/members`, `DELETE /:id/members/:userId`,
    `PUT|DELETE /departments/:id`, teams (`GET|POST /teams`, `DELETE /teams/:id`), employees (`GET /employees`).
20. Notification lifecycle — MISSING: `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`,
    `GET|PUT /notification-preferences`, `POST /notifications/test {type}`.
21. RBAC role guard (403 on member write) + notification event emission
    (risk_alert/deadline_slip/sync_failed/sprint_closeout/report_ready) — MISSING.

## F. 🔧 Required FRONTEND changes (`raw-test/`) — both input docs are frontend-side

Backend-exists ⇒ FE can wire now. Backend-missing ⇒ FE change waits on backend.

### F1. Can be wired NOW (backend already ships it)
- [ ] **Git activity feeds (§6b):** `lib/api/gitIntelligence.ts` currently probes
      `GET /:id/git/commits|pull-requests|contributors` as "missing" — they now EXIST in backend.
      Wire `GET /v1/projects/:id/git/commits|pull-requests|contributors` (+`metrics`, `activity`)
      into the GitHub-activity section; drop the empty-feed fallback.
- [ ] **Global sync (§5):** `triggerSync()` in `lib/api/integrations.ts` currently `throws`.
      Replace with `POST /v1/projects/:projectId/sync` (fan-out, optionally `{integration_id}` in body)
      and wire the Navbar quick-sync button to it.
- [ ] **Taiga without manual token (§5):** backend auto-exchanges username/password → cached `auth_token`
      (`authenticateTaiga`). FE should send `{provider:'taiga', username, password}` on create/update
      instead of demanding a token, and soften/remove the `TAIGA_TOKEN_REQUIRED` hard error.
- [ ] **Sprint create (§6c):** `POST /v1/sprints` is mounted — expose "create sprint" in the UI
      (needed later by the plan `apply` flow).
- [ ] **Projects list paging (§2):** backend already returns `{rows,count,page,limit,total_pages,total}`;
      move FE portfolio list to server `page/limit` (keep client filter until `search/status/sort` land).
- [x] **Branch picker (§5):** `POST /v1/integrations/:id/branches` endpoint + `branch` field shipped on
      backend; FE wizard branch input, `⎇ <branch>` badge, and Edit-details `↻` datalist picker now
      implemented in `IntegrationsView.tsx` + `lib/api/integrations.ts`; contract documented in
      `package/uigit.md` ("Branch selection" section).

### F2. Small wiring AFTER backend confirms each route
- [ ] **Retro save (§6a):** connect the draft-only retrospective textarea to `PUT /v1/sprints/:id`
      (once backend accepts `retrospective_notes`) — the textarea comment already says
      "persisted via PUT when routes land".
- [ ] **Report buttons (§3):** add Generate / Status / Export / Send buttons once B-③–⑥ ship.
- [ ] **Auth user (§1):** once B-① ships, read `user` from `generateToken`
      (`lib/api/auth.ts` already expects `{access_token, refresh_token, user}`) and remove the
      fake `currentUser.id` / `owner_id`-from-existing-project derivation.
- [ ] **Plans (§4):** replace localStorage hide/draft/accepted with server `status` once B-⑦–⑩ ship;
      add plans paging/sort params to `lib/api/plans.ts`.
- [ ] **Admin/Notifications nav (§8):** mount the coded-but-unreachable `AdminView`/`NotificationsView`
      (one-line nav change) once B-⑲–⑳ are confirmed; wire read/read-all/prefs/test calls.
- [ ] **Model switch + feature flags (§7):** no FE change needed — `features.ts` and provider switch
      already handle them with graceful fallback; they light up when B-⑮–⑯ ship.

### F3. Needs NO frontend change (lights up automatically)
- `GET /v1/feature-flags`, git list routes, providers catalog, model-switch — all coded with
  graceful fallback in FE (`features.ts`, `gitIntelligence.ts`, `ai.ts`).

*End — intplan.md generated 2026-09-14: 26 backend items checked against `package/src`
→ ~6 EXIST, ~20 MISSING; FE actions split into Now (F1) / After-backend (F2) / Auto (F3).*
