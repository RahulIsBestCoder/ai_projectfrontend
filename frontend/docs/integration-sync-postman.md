# GitHub & Taiga Sync — Postman Setup

Both integrations use the **same** endpoint. The provider is determined by the
`provider` field stored on the integration document in MongoDB — no separate URL.

> **Endpoint:** `POST /v1/integrations/<IntegrationID>/sync`

---

## 🐙 GitHub Sync

### Prerequisites (integration document in MongoDB)

| Field            | Required Value                                       |
|------------------|------------------------------------------------------|
| `provider`       | `"github"`                                           |
| `token`          | Valid GitHub PAT (with `repo` scope)                 |
| `repository_name`| `"owner/repo"` format                                |
| `repository_url` | `https://github.com/owner/repo` (optional, used to parse owner/repo) |
| `is_deleted`     | `false`                                              |

### Postman Request

| Tab     | Value                                                        |
|---------|--------------------------------------------------------------|
| Method  | `POST`                                                       |
| URL     | `http://localhost:3000/v1/integrations/<IntegrationID>/sync` |
| Headers | `Content-Type: application/json`<br>`Accept: application/json` |
| Body    | none (or empty `{}`)                                         |

### What It Does

1. `GET https://api.github.com/repos/{owner}/{repo}/commits?per_page=100`
2. `GET https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&sort=created&direction=desc`
3. `GET https://api.github.com/repos/{owner}/{repo}/commits/{sha}` — per-commit stats, up to 50

### Expected 200 Response

```json
{
    "status": true,
    "status_message": "Sync complete.",
    "data_sets": {
        "status": "success",
        "items_synced": {
            "commits": 100,
            "pull_requests": 25,
            "total": 125
        }
    }
}
```

### Possible 400 Errors

| Condition                                        | Message                                                                  |
|--------------------------------------------------|--------------------------------------------------------------------------|
| Integration not found                            | `"Integration not found."`                                               |
| Provider not github/taiga                        | `Sync for provider "xxx" is not supported yet (github, taiga).`          |
| No token on integration                          | `GitHub sync needs an access token on the integration.`                  |
| Can't parse owner/repo                           | `Set repository_name to "owner/repo" (got "...").`                       |
| GitHub API error (401/403/404)                   | `GitHub 404: Not Found (owner/repo)` — caught and returned as 400        |

---

## 📋 Taiga Sync

### Prerequisites (integration document in MongoDB)

| Field             | Required Value                          |
|-------------------|-----------------------------------------|
| `provider`        | `"taiga"`                               |
| `token`           | Optional — used directly when present. If absent, `username` + `password` are used to authenticate and the returned token is cached on the integration document. |
| `username`        | Taiga account username (required when no token is stored) |
| `password`        | Taiga account password (required when no token is stored) |
| `repository_name` | Taiga project slug or ID (e.g. `my-project`) |
| `repository_url`  | Optional — the Taiga project page (e.g. `https://tree.taiga.io/project/my-project`); the slug is derived from `/project/<slug>` or the last URL segment when present. |
| `project_id`      | Linked project ID (used to associate synced data) |
| `is_deleted`      | `false`                                 |

### Postman Request

| Tab     | Value                                                        |
|---------|--------------------------------------------------------------|
| Method  | `POST`                                                       |
| URL     | `http://localhost:3000/v1/integrations/<IntegrationID>/sync` |
| Headers | `Content-Type: application/json`<br>`Accept: application/json` |
| Body    | none (or empty `{}`)                                         |

### What It Does

1. If no `token` is stored on the integration but `username` + `password` are present: `POST https://api.taiga.io/api/v1/auth` with `{ type: "normal", username, password }` → cache the returned `auth_token` on the integration document.
2. `GET https://api.taiga.io/api/v1/milestones?project_id={id}`
3. `GET https://api.taiga.io/api/v1/user_stories?project_id={id}`
4. `GET https://api.taiga.io/api/v1/tasks?project_id={id}`
5. `GET https://api.taiga.io/api/v1/sprints?project_id={id}`

### Expected 200 Response

```json
{
    "status": true,
    "status_message": "Sync complete.",
    "data_sets": {
        "status": "success",
        "items_synced": {
            "work_items": 30,
            "sprints": 3,
            "tasks": 45,
            "sprint_summaries": 3,
            "task_statuses": 5,
            "total": 86
        }
    }
}
```

### Possible 400 Errors

| Condition             | Message                                      |
|-----------------------|----------------------------------------------|
| Integration not found | `"Integration not found."`                   |
| Provider not github/taiga | `Sync for provider "xxx" is not supported yet (github, taiga).` |
| Taiga API error       | `Taiga sync failed.` — with the underlying error message |

---

## 📊 Side-by-Side Comparison

| Aspect                 | GitHub                                     | Taiga                                    |
|------------------------|--------------------------------------------|------------------------------------------|
| Provider value         | `"github"`                                 | `"taiga"`                                |
| Auth token needed?     | ✅ Yes (GitHub PAT)                        | ✅ Yes (Taiga API token)                 |
| API base               | `https://api.github.com`                   | `https://api.taiga.io/api/v1`            |
| Auth header            | `Authorization: Bearer <token>`            | `Authorization: Bearer <token>` (Taiga)  |
| Data fetched           | Commits, Pull Requests, per-commit stats   | Milestones, User Stories, Tasks, Sprints |
| Local collections written | `git_commits`, `git_pull_requests`      | `tasks`, `sprint_summaries`              |
| Sync history           | ✅ Written to `sync_history`               | ✅ Written to `sync_history`             |
| Postman body           | None needed                                | None needed                              |
| URL format             | Same: `POST /v1/integrations/:id/sync`     | Same: `POST /v1/integrations/:id/sync`   |

---

## 🧪 Testing Both in Postman

**GitHub Test**

```http
POST http://localhost:3000/v1/integrations/6aa46b5ce2d402070aad41ff/sync
Headers: Content-Type: application/json
Body: (none)
```

**Taiga Test**

```http
POST http://localhost:3000/v1/integrations/<different-integration-id>/sync
Headers: Content-Type: application/json
Body: (none)
```

> **Note:** Both use the exact same endpoint URL. The provider is determined by
> the `provider` field stored in the integration document in the database. You
> don't need different URLs — just different integration IDs.

---

## 🔍 How to Tell Which Provider an Integration Uses

Before calling sync, check the integration document:

```javascript
// MongoDB
db.integrations.findOne({ _id: ObjectId("6aa46b5ce2d402070aad41ff") })
```

---

## ✅ Verified against the implementation

The response shapes above match `integration_service.ts` on the backend:

- `syncIntegration` (GitHub) → returns `data_sets: { status: 'success', repository_id, items_synced: { commits, pull_requests, total } }`
- `syncTaiga` → returns `data_sets: { status: 'success', items_synced: { work_items, sprints, tasks, sprint_summaries, task_statuses, total } }`

Actual outbound calls used by the code:

| Provider | Endpoints (as implemented) |
|----------|----------------------------|
| GitHub   | `GET /repos/{o}/{r}/commits?per_page=100`, `GET /repos/{o}/{r}/pulls?state=all&per_page=100&sort=created&direction=desc`, `GET /repos/{o}/{r}/commits/{sha}` (first 50) |
| Taiga    | `POST /projects/by_slug?slug=…` (via base `https://api.taiga.io/api/v1`), `GET /userstories?project={id}`, `GET /milestones?project={id}`, `GET /task-statuses?project={id}`, `GET /tasks?milestone={id}` (per milestone) |

Dependencies can be seeded in Postman from the bundled collection:
`docs/integrations-sync.postman_collection.json`.