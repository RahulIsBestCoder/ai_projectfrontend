# AI Project Intelligence Platform — Frontend

A single-page React admin dashboard for the **AI Project Intelligence Platform**.
Give the AI a project plan and a deadline; it drafts the sprint plan. Connect
GitHub / Taiga; the platform then checks whether real development is tracking the
plan and whether the deadline is reachable.

> This repo is **frontend only**. It talks to a separate Node/Express/MongoDB API
> (see [The backend](#the-backend)). Every screen renders exactly what the API
> returns — there is no mock data.

---

## 1. Tech stack

| Area | Choice |
|---|---|
| UI | **React 19** + **TypeScript 5.9** |
| Build/dev server | **Vite 8** (`@vitejs/plugin-react`) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) |
| HTTP | **axios** (one shared instance with an envelope-unwrap interceptor) |
| Charts | **Recharts** |
| Icons | **lucide-react** |
| Routing/state | Plain component state — a single data hub in `src/App.tsx`. **No** React Router, **no** TanStack Query. |

> The `next` dependency and the `'use client'` directives are vestigial — the app
> builds and runs entirely through Vite. Ignore them.

---

## 2. Prerequisites

- **Node.js ≥ 20** (Node 22 recommended — the backend's sync feature uses global `fetch`)
- **npm** (a `package-lock.json` is committed)
- The **backend API** running and reachable (default `http://localhost:3000/v1`)
- **MongoDB** for the backend (Atlas connection string or local `mongod`)

---

## 3. The backend

The API lives in a sibling project:

```
…/aiProject2026/aiProject/backendApi
```

Start it first:

```bash
cd path/to/aiProject2026/aiProject/backendApi
npm install
cp .env.example .env          # set MONGODB_URI / DB_NAME, GEMINI_MODEL, etc.
npm run seed:mongo            # seed users, orgs, projects, analytics, git, sprints…
npm run seed:defaults
npm run seed:week
npm run dev                   # nodemon + ts-node, listens on :3000
```

If `POST /v1/user/generateToken` returns *"User not found"*, the DB the backend is
connected to wasn't seeded with that account — try the other seed set or check
`MONGODB_URI` / `DB_NAME` in the backend `.env`.

---

## 4. Install & run (frontend)

```bash
npm install
cp .env.example .env          # then edit — see §5
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`).

> ⚠️ **Port clash.** The `dev` script is `vite --host 0.0.0.0 --port 3000`, but the
> **backend also uses :3000**. Run the frontend on another port:
>
> ```bash
> npm run dev -- --port 5173
> ```
>
> or change `"dev"` in `package.json` to `--port 5173` permanently (recommended).

---

## 5. Environment variables

`.env` is git-ignored (`.gitignore` keeps only `.env.example`). Copy the example
and edit it.

**Only one variable is actually read by the code** — the API base URL. It is
resolved in [`lib/api/env.ts`](lib/api/env.ts) and accepts either prefix:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` (or `NEXT_PUBLIC_API_BASE_URL`) | `http://localhost:3000/v1` | Base URL for every API call. **Must include `/v1`.** |

### Example `.env`

```env
# The only value the frontend needs. Must end in /v1.
VITE_API_BASE_URL="http://localhost:3000/v1"
```

### Legacy keys (ignored — safe to delete)

Older `.env` files carry these. **Nothing in the code reads them** — no feature
flags are implemented, and secrets are backend-only:

```env
# VITE_FF_AUTH / VITE_FF_CRUD / VITE_FF_PROJECT_LIST / VITE_FF_ANALYTICS
# VITE_FF_GITHUB / VITE_FF_TAIGA / VITE_FF_AI_PREDICT / VITE_FF_SYNC   ← unused
# GEMINI_API_KEY   ← backend-only, never ship to the browser
# APP_URL          ← unused
```

There is **no auth secret, DB URL, or Gemini key** in the frontend. If a route is
unavailable the screen shows an empty/error state, not sample data.

---

## 6. `package.json` reference

### Scripts

| Script | Command | Notes |
|---|---|---|
| `npm run dev` | `vite --host 0.0.0.0 --port 3000` | Dev server + HMR. Override the port (see §4). |
| `npm run build` | `vite build` | Production bundle → `dist/`. |
| `npm run lint` | `eslint .` | Flat config in `eslint.config.mjs`. |
| *(typecheck)* | `npx tsc --noEmit` | No dedicated script; run directly. `tsconfig.json` has `noEmit`, `strict`. |

There is **no test runner** configured.

### Key dependencies

```jsonc
"dependencies": {
  "react": "^19.2.1",            // + react-dom
  "axios": "^1.20.0",            // HTTP client (see lib/api/http.ts)
  "recharts": "^3.10.1",        // charts (health gauge, trends, burndown…)
  "lucide-react": "^0.553.0",   // icons
  "zod": "^4.4.3",              // schema validation (forms)
  "@hookform/resolvers": "^5.2.1",
  "clsx": "^2.1.1", "tailwind-merge": "^3.3.1", "class-variance-authority": "^0.7.1",
  "motion": "^12.23.24",
  "@google/genai": "^2.4.0",    // present; AI calls actually go through the backend
  "next": "^15.4.9"             // vestigial — app runs on Vite
},
"devDependencies": {
  "vite": "^8.2.2", "@vitejs/plugin-react": "^6.1.1",
  "typescript": "5.9.3",
  "tailwindcss": "4.1.11", "@tailwindcss/vite": "^4.3.3", "@tailwindcss/postcss": "4.1.11",
  "eslint": "9.39.1", "eslint-config-next": "16.0.8",
  "@types/node": "^20", "@types/react": "^19", "@types/react-dom": "^19",
  "firebase-tools": "^15.0.0"   // optional deploy tooling
}
```

Full, authoritative list: [`package.json`](package.json).

---

## 7. Project structure

```
├── index.html                 # Vite entry
├── vite.config.ts             # port 3000, alias "@" -> repo root, Tailwind plugin
├── tsconfig.json              # strict, noEmit, "@/*" paths
│
├── src/
│   ├── main.tsx               # React root
│   ├── App.tsx                # ★ data hub — auth gate, project selection, tab routing,
│   │                          #   loads org + project-scoped data, passes it down
│   └── index.css
│
├── components/
│   ├── LoginView.tsx          # 2-step login / forgot-password / OTP
│   ├── Navbar.tsx  Sidebar.tsx
│   ├── PortfolioDashboard.tsx # "Projects" landing + Create Project modal
│   ├── OverviewDashboard.tsx  AiIntelligence.tsx  DepartmentHealth.tsx
│   ├── PlansView.tsx          # AI sprint planner: brief → generate → edit → accept
│   ├── ReportsView.tsx  IntegrationsView.tsx
│   ├── WorkItemsBoard.tsx  SprintIntelligence.tsx  GithubAnalytics.tsx
│   ├── ProjectAnalytics.tsx  RiskAnalysis.tsx
│   └── project/
│       ├── Execution.tsx      # wraps Sprint + WorkItems + GitHub into one tab
│       └── Health.tsx         # wraps Analytics + Risk into one tab
│
├── lib/
│   ├── api/
│   │   ├── http.ts            # axios instance + response-envelope interceptor + 401 refresh
│   │   ├── env.ts             # API_BASE_URL resolution
│   │   ├── case.ts            # snake_case ⇄ camelCase, _id ⇄ id
│   │   ├── util.ts            # rowsOf / oneOf / safeRead unwrap helpers
│   │   ├── auth.ts  projects.ts  plans.ts  workItems.ts  sprints.ts
│   │   ├── integrations.ts  gitIntelligence.ts  analytics.ts  risk.ts
│   │   ├── ai.ts  reports.ts  notifications.ts  organizations.ts  departments.ts
│   │   └── index.ts           # barrel — components import from "@/lib/api"
│   ├── acceptedPlan.ts        # per-project committed-plan store (localStorage)
│   └── analytics/calculator.ts
│
├── types/index.ts             # all shared TS interfaces
├── hooks/use-mobile.ts
│
├── history.md                 # ★ manual changelog — every change + how to undo it
├── planimplement-frontend-notes.md   # /v1/plans integration notes
├── frontend-plan.md           # original API contract / design brief
└── _backup/<timestamp>/       # pre-change file copies (see history.md)
```

---

## 8. How it talks to the API

Every response is wrapped:

```json
{ "response": {
  "dataset": { "...": "payload (object, array, or { rows, count, page, … })" },
  "status":  { "msg": "…", "action_status": true },
  "publish": { "version": "1.0.0", "developer": "aiproject" }
} }
```

[`lib/api/http.ts`](lib/api/http.ts) does the plumbing:

- unwraps `response.dataset` onto `res.data`;
- on `action_status: false` (or a plain `{ "message": … }` 400) throws `ApiError` with `.msg`;
- attaches `Authorization: Bearer <token>` from `localStorage` (`aipi_access`);
- on `401`, calls `POST /user/regenerateToken` once, retries, else dispatches
  `window` event `auth:unauthorized` → back to login.

Adapters in `lib/api/*.ts` then convert case (`toApi`/`fromApi`), unwrap lists
(`rowsOf`) or single docs (`oneOf`), and wrap reads in `safeRead` so an
unimplemented route degrades to an empty screen.

---

## 9. Feature notes / current limitations

| Area | State |
|---|---|
| **Auth** | 2-step: `POST /user/login` → `POST /user/generateToken`. Tokens in `localStorage` (`aipi_access` / `aipi_refresh`). `generateToken` returns **no user object**, so "Create Project" derives `owner_id` from an existing project. |
| **Create Project** | `POST /v1/projects` needs `name` + `organization_id` + `owner_id`. Modal on the Projects page; org/owner pre-filled, editable. |
| **AI plan** | `POST /v1/plans` runs synchronously (5–25 s, up to ~90 s; 120 s client timeout). Plan is editable; "Accept" stores it in `localStorage` per project. "Previous plans" list has a client-side hide (no backend delete). |
| **Integrations** | `POST /v1/integrations` links a repo/board. **Sync now** → `POST /v1/integrations/:id/sync`: GitHub (commits + PRs, with per-commit line stats) works; **Taiga needs an API token** on the integration. Re-linking a disconnected integration revives it. |
| **Reports** | Create / list / delete via `/v1/reports`. **No** generate job, export, or email endpoints — those buttons are removed. A completed report's file is only its `artifact_url`. |
| **AI Assistant** | `POST /v1/ai/chat` takes `{ prompt, project_id }` (not `message`). The frontend also inlines the project's plan into the prompt so it can answer team/schedule questions. |
| **Providers list** | `GET /v1/integrations/providers` does not exist — the two provider cards are a static list. |

See [`history.md`](history.md) for the full change log and rollback steps for
every modification.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank screen, `net::ERR_CONNECTION_REFUSED` on `/v1/...` | Backend not running, or `VITE_API_BASE_URL` wrong. Start the backend on :3000. |
| Dev server won't start / "port 3000 in use" | Backend already has :3000 — `npm run dev -- --port 5173`. |
| Login fails with valid seed creds | Backend connected to an unseeded DB — check backend `MONGODB_URI`/`DB_NAME`, re-run `npm run seed:mongo`. |
| A tab is empty but the API has data | You're viewing a **different selected project** — check the project name in the top bar (Integrations/Reports headers show it). |
| "Create Project" button does nothing after submit | Needs a valid `owner_id`. If you have zero projects, paste a user `_id` into the modal's Owner field. |
| AI chat gives generic answers | The selected project has no analytics/risk rows yet (freshly created). Seeded demo projects answer richly. |
| Sync says "Taiga sync needs an API token" | Add a Taiga auth token to that integration (Taiga's API rejects anonymous access even for public boards). |

---

## 11. Build & deploy

```bash
npm run build      # -> dist/  (static SPA)
```

Serve `dist/` from any static host (Nginx, Vercel, Firebase Hosting, …). Set
`VITE_API_BASE_URL` at **build time** to the production API URL. Ensure the API's
CORS allows the frontend origin (it is `*` in development).
