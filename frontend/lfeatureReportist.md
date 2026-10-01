# Feature Report — Side-Nav Wise Flow (lfeatureReportist.md)

> Project: `raw-test` — AI Project Intelligence Platform (Frontend only, React 19 + Vite + Tailwind)
> Generated: 2026-09-14 | Audit: `components/Sidebar.tsx`, `src/App.tsx`, `components/*`, `lib/api/*`, `README.md`
> Nav source: `Sidebar.tsx groups[]` = 3 groups, 10 visible items + Navbar + Auth gate

## Side-Nav Map (as rendered)

```
- AI Project Intelligence (always visible)
  - Projects (portfolio) — default landing, no project required
  - Reports (reports) — requires selectedProjectId
  - Integrations (integrations) — requires selectedProjectId
- Project (only when hasProject=true / selectedProjectId set)
  - Overview (overview)
  - Plan (plan)
  - Execution (execution)
  - Health (health, badge delayRisk% if >50%)
  - Departments (departments)
  - AI Assistant (ai)
- System
  - Settings (settings)
+ Top Navbar: brand, project selector, 15-min Sync, RBAC switcher, sign-out
+ Auth gate (no nav): LoginView
```

Legacy TabType ids `workitems/sprints/github/analytics/risks/plans/sync/admin` are kept for compat but NOT in nav — composed into Execution/Health.

## 1. Summary — Completed vs Remaining

| # | Section (tab id) | Status | File | Completeness |
|---|---|---|---|---|
| 0 | Auth / Login (gate) | COMPLETED | LoginView.tsx | 100% — login/forgot/otp/reset all wired |
| — | Top Navbar | COMPLETED | Navbar.tsx | 100% — selector+sync+RBAC+signout |
| 1 | Projects (portfolio) | COMPLETED | PortfolioDashboard.tsx | ~95% — list/create/open works; edit/delete/search missing |
| 2 | Reports (reports) | COMPLETED | ReportsView.tsx | ~85% — CRUD+PDF works; generate/export/email missing (no backend route) |
| 3 | Integrations (integrations) | COMPLETED | IntegrationsView.tsx | ~95% — GitHub works + Taiga auto-token on backend; FE wiring pending (intplan F1) |
| 4 | Overview (overview) | COMPLETED | OverviewDashboard.tsx | ~95% — all cards from live data |
| 5 | Plan (plan) | COMPLETED | PlansView.tsx (1526 lines) | ~90% — AI+manual+edit+accept works; server PUT/DELETE/apply deferred to localStorage |
| 6 | Execution (execution) | COMPLETED (wrapper) | project/Execution.tsx | ~95% — all 5 sub-sections wired; git feeds + sprint-create backend-ready for FE wiring (intplan F1) |
| 7 | Health (health) | COMPLETED (wrapper) | project/Health.tsx | ~95% — both sub-sections wired |
| 8 | Departments (departments) | COMPLETED | DepartmentHealth.tsx | ~90% — gauges+comparison works |
| 9 | AI Assistant (ai) | COMPLETED | AiIntelligence.tsx + ProjectContextPanel.tsx | ~90% — predict+simulate+chat+context works |
| 10 | Settings (settings) | COMPLETED | SettingsView.tsx | ~80% — provider switch live; flags/model-pref derived or client-side |
| — | Admin/Notifications/Sync page/Taiga page/SettingsModal | REMAINING (orphaned) | AdminView, NotificationsView, SyncEngine, TaigaTracking, SettingsModal | 0% exposed — coded but never routed in App.tsx |

> Overall: 10/10 visible nav sections render real backend data (no mocks). Remaining = backend gaps + 5 orphaned components (coded but not routed: Admin, Notifications, Sync page, Taiga page, SettingsModal).

## 2. Auth Gate + Navbar (no side-nav)

### 0. Auth Gate — LoginView.tsx (App.tsx:302 if(!authed))
- Login (email+password) — COMPLETED — POST /user/login then POST /user/generateToken, tokens aipi_access/aipi_refresh.
- Forgot password — COMPLETED — forgotPassword(email), notice check backend log.
- OTP verify — COMPLETED — verifyOtp(email,otp).
- Reset password — COMPLETED — resetPassword(email,newPassword).
- Seed quick buttons — COMPLETED — admin/pm/dev1/dev2 @aiproject.local + Admin@123.
- 401 bounce to login — COMPLETED — http.ts auth:unauthorized event.
- REMAINING: generateToken returns no user object, owner_id derived from existing project; no signup.

### Top Navbar — Navbar.tsx (App.tsx:329)
- Brand + v2.4.0 Backend badge — COMPLETED (static).
- Project selector dropdown — COMPLETED — projects[], onSelectProject.
- 15-Min Sync button — COMPLETED — handleTriggerSync(), isSyncing spinner.
- RBAC switcher Admin/TechLead/EngManager/Developer — COMPLETED client-only (ROLE_FROM_BACKEND maps super_admin to ADMIN; no backend enforcement).
- Sign-out — COMPLETED — clearAuth().

## 3. Group: AI Project Intelligence

### 1. Projects (portfolio) — PortfolioDashboard.tsx, route App.tsx:350 (landing)
- Portfolio stats + project cards + health gauge (Healthy>=75/Watch>=50/Critical) — COMPLETED via listProjects().
- Create Project modal (name+status+desc+orgId+ownerId) — COMPLETED via POST /v1/projects (needs name+organization_id+owner_id; prefilled, editable; fallback to first project owner/org).
- Open project -> sets selectedProjectId + jumps to overview — COMPLETED.
- Loading/empty states — COMPLETED.
- REMAINING: edit/delete/archive project; search/filter/sort — no UI/API wired.

### 2. Reports (reports) — ReportsView.tsx, route App.tsx:440 (needs selectedProjectId)
- List — COMPLETED — listReports(projectId), status pill completed/processing/pending/failed.
- New report (name+type+period+format) — COMPLETED — createReport, REPORT_TYPES/PERIODS/FORMATS.
- Download PDF — COMPLETED — fetchReportArtifact artifact_url else fallback buildProjectSummaryPdf() (lib/reportPdf.ts + saveBlob/slugify).
- Delete — COMPLETED — deleteReport with spinner.
- REMAINING: generate job / export csv-xlsx / email / scheduling — backend has no route (buttons removed by design, README 9).

### 3. Integrations (integrations) — IntegrationsView.tsx (~781 lines), route App.tsx:447
- Provider catalog cards GitHub/Taiga — COMPLETED — getProviderCatalog() + static fallback (GET /v1/integrations/providers does not exist).
- Connected list Active/Inactive/Error — COMPLETED — listProjectIntegrations(projectId).
- Connect wizard (repoName+repoUrl+token+category; Taiga username/password) — COMPLETED — connectProjectIntegration(); categories via getRepoCategories()+FALLBACK.
- Edit details + token reveal + Taiga creds edit — COMPLETED — updateIntegration().
- Sync now — COMPLETED — syncIntegration()+summariseSync(); GitHub commits+PRs+line stats works.
- Sync history expandable — COMPLETED — getIntegrationSyncHistory().
- Disconnect / re-link revive — COMPLETED.
- REMAINING: FE still demands a manual Taiga token (backend auto-exchanges username/password per intplan §A — soften error, F1); OAuth (manual PAT only); server provider catalog route.



## 4. Group: Project (needs selectedProjectId)

### 4. Overview (overview) — OverviewDashboard.tsx, route App.tsx:365 (needs project+analytics)
- Header delayRisk/healthScore/dates/sync — COMPLETED.
- PR latency avg + stale>24h — COMPLETED (derived created_at to merged_at; no backend metric).
- Code churn add/del/ratio — COMPLETED (sum commits).
- Velocity planned-vs-completed BarChart + active sprint — COMPLETED.
- Risk factors + QA ratio + Trigger Sync CTA + forecast p50/p80/p95 — COMPLETED.
- REMAINING: none blocking; empty state prompts Taiga sync when no sprints.

### 5. Plan (plan) — PlansView.tsx, route App.tsx:389
- AI form (description*, project_name, team_size 4, duration 8, sprint_len 2, start today, constraints) — COMPLETED — generatePlan() POST /v1/plans, 120s timeout, stepped loader + Cancel.
- Previous plans + load into editor — COMPLETED — listPlans/getPlan; hide via hidePlanId (no backend DELETE).
- Editable editor + dirty flag + diffPlan() — COMPLETED.
- Accept to checklist — COMPLETED — acceptPlan() + localStorage aipi_plan:<projectId>.
- Edit accepted + Publish + Manual blank/last-AI + banner + Regenerate/Reset — COMPLETED.
- REMAINING (needs backend): PUT/DELETE /plans/:id, POST /plans/:id/apply, acceptedAt + server-set 'accepted' status (model already has `status: draft`, intplan §A·§4), pagination/sort/auth.

### 6. Execution (execution) — project/Execution.tsx, route App.tsx:400
- 6.1 Sprint planning checklist — COMPLETED — PlanExecutionPanel: accepted plan + getPlanExecution/toggleExecutionItem, progress bar, Rebuild.
- 6.2 Current sprint — COMPLETED — SprintIntelligence: selector defaults active sprint; SprintStatusTabs; Burndown/Burnup/Velocity; Retro textarea PARTIAL (draft only until backend adds `retrospective_notes` to PUT /sprints/:id — intplan §6·a).
- 6.3 Sprint comparison — COMPLETED — SprintComparison getSprintComparison: overview %, progress, Burndown-vs-Actual, By-Priority.
- 6.4 Work items Kanban — COMPLETED — WorkItemsBoard: 4 cols, drag-drop status, assignee/priority, filters.
- 6.5 GitHub activity — COMPLETED — GithubAnalytics: repo selector+cards, churn Area, PR latency, commits feed. Feed routes now exist on backend (intplan §A·§6) — FE empty-feed fallback can be dropped (F1).

### 7. Health (health) — project/Health.tsx, route App.tsx:414
- 7.1 Health components and trend — COMPLETED — ProjectAnalytics: health+strategies+trend Line+radar, DORA + git activity Bar, dept table.
- 7.2 Risk and deadline prediction — COMPLETED — RiskAnalysis: list+analyze risks, level filter, source tags Auto/AI/Manual, forecast p50/p80/p95, deadline predictDeadline % bar.
- REMAINING: none blocking.

### 8. Departments (departments) — DepartmentHealth.tsx, route App.tsx:421
- Dept cards (gauge + items/completion/points + status bar) — COMPLETED — listDepartments + getDepartmentMetrics.
- Comparison BarChart — COMPLETED.
- REMAINING: create/edit only in orphaned AdminView.

### 9. AI Assistant (ai) — AiIntelligence.tsx + ProjectContextPanel.tsx, route App.tsx:423
- Header + simulator sliders + Simulate — COMPLETED — onRunPrediction(prompt).
- Action Plan list + provider badge — COMPLETED (helper hardcodes Gemini 3.6 Flash — make dynamic).
- Project context snapshot — COMPLETED — get/rebuildProjectContext, 2500-char budget.
- Ask AI Q&A + history — COMPLETED — POST /v1/ai/chat {prompt,project_id}.
- REMAINING: simulator prompt-only; generic answers on fresh projects.

## 5. Group: System

### 10. Settings (settings) — SettingsView.tsx, route App.tsx:458
- Provider cards GEMINI/GROK/OLLAMA + Switch — COMPLETED — getAIProviders/switchAIProvider.
- Model catalog + per-provider pref — PARTIAL — getAiModels works but no backend switch route, pref is client-side aipi_model:<PROVIDER> via set/getModelPreference.
- Feature flags panel — PARTIAL (derived) — deriveFlags() from catalog; GET /v1/feature-flags missing so fallback.
- User/org/project counts — COMPLETED (display).
- Workspace integrations table Sync/Unlink — COMPLETED — listWorkspaceIntegrations/sync/disconnect.
- REMAINING: real flags route, model-switch route, remove static GEMINI_API_KEY label.

## 6. Orphaned / Not-in-Nav (REMAINING — coded but unreachable, App.tsx never imports them)

| Component | Sub-sections coded | To expose |
|---|---|---|
| AdminView.tsx (settings/members/departments/teams/employees) | get/updateOrgSettings, list/add/removeOrgMembers, list/create/deleteDepartments+metrics, list/create/deleteTeams, listEmployees; ROLES super_admin/org_admin/project_manager/member/viewer | Add Admin under System + branch in App |
| NotificationsView.tsx (feed+prefs) | get/mark/markAllNotifications, get/updatePrefs, sendTest; types risk_alert/deadline_slip/sync_failed/sprint_closeout/report_ready/mention/assignment | Add bell route or System item |
| SyncEngine.tsx (15-min pipeline page) | logs SyncLog[], SYNC_15MIN terminal feed commits/PRs/stories | Route sync tab (getSyncLogs already in App state) or delete |
| TaigaTracking.tsx (legacy board) | sprints/stories/tasks/issues props, kanban, severity, tasks | Superseded by WorkItems+SprintIntelligence — delete or keep ref |
| SettingsModal.tsx (dark modal) | provider switch modal, hardcoded acme-software-labs | Superseded by SettingsView page — delete |

Shared (always COMPLETED, not nav): Collapsible, lib/api/* (auth/projects/orgs/depts/plans/workItems/sprints/integrations/gitIntelligence/analytics/risk/ai/features/reports/notifications), calculator.ts, pdf.ts/reportPdf.ts, acceptedPlan.ts/planDraft.ts.

## 7. Flow (user journey)

Login -> Portfolio (list/create/open) -> select project -> Overview (track? Deep AI / Sync) -> Plan (describe->Generate 5-25s->edit->Accept) -> Execution (checklist->sprint charts->compare->kanban->GitHub) -> Health (trend+DORA->risks->forecast->deadline %) -> Departments (gauges) -> AI Assistant (simulate->ask grounded) -> Reports/Integrations/Settings anytime. Guards: Reports/Integrations/Overview/Plan/Execution/Health/AI show EmptyState when no project; Overview/AI also need analytics bundle.

## 8. Remaining checklist

Frontend-only: **decide the 5 orphaned components — expose Admin + Notifications in the nav, delete TaigaTracking + SettingsModal + SyncEngine page**; Projects edit/delete/search; Departments create inline; Retro save button; dynamic provider label; remove next dep + use client; fix dev port 5173 clash.
Needs backend (refreshed per intplan.md audit): PUT/DELETE /plans/:id, POST /plans/:id/apply, acceptedAt + server-set accepted status, plan paging/auth; Reports generate/export/email; providers catalog + OAuth; retro save (`retrospective_notes` on PUT /sprints/:id); real feature-flags + model-switch; generateToken return user; fill backend requirement .md template. (Now EXIST backend-side — FE wiring only: global sync, Taiga auto-token, git feed routes, sprint POST/PUT/DELETE, project page/limit.)

## 9. Verification

Read Sidebar.tsx groups + App.tsx branches + each view imports/API calls; grep orphans (zero App imports); cross-checked README 9 + planimplement-frontend-notes Parts A-C; backend existence re-verified 2026-09-14 against `/home/developer/Downloads/package/src` via [`intplan.md`](intplan.md). End.
