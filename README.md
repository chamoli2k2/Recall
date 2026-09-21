# Recall

A collaborative flashcard application built with **React, Express, and MongoDB**. The UI uses Radix primitives, Lucide icons, and a custom responsive design system. AI and RAG are intentionally disabled; an extension interface and transactional domain events provide a future integration boundary.

## What is included

- Accounts with unique, normalized usernames; password hashing and opaque HttpOnly sessions.
- Private and global folders; every card belongs to exactly one folder.
- Two-sided text and image cards, tags, hints, source links, bookmarks, search, and per-tab drafts.
- Sharing with existing users by username, with owner/editor/viewer permissions.
- Collaborative editing with version conflict detection, change history, and restoration into a new draft.
- Folder activity and polling for committed changes every 15 seconds while viewing a folder.
- Global discovery, public profiles, anonymous public-card viewing, saved collections, and private copies.
- Quick review, due-card study, review scheduling, daily goals, personal progress, and keyboard shortcuts.
- Archive and restore folders; confirmed permanent deletion of individual cards.
- Permission-checked image delivery. Images are decoded, resized, stripped of metadata, and stored in MongoDB.

## Preview versus the full application

The hosted preview is an explicitly labelled, **in-memory sample workspace**. It resets on refresh. It does not create real accounts, persist uploads, or collaborate across browsers. Real API failures never silently switch the production app into demo mode.

The downloadable source includes the complete Express API and MongoDB models. Run the full app below for real accounts and shared durable data. The preview hosting platform does not run the Node server or a MongoDB database.

## Quick start with Docker

Prerequisites: Docker with Compose.

```bash
docker compose up --build
```

Open **http://localhost:4000** and create an account. Create a second account in another browser profile, then share a folder using that account's username. No email service is needed for username-based access grants.

Compose runs a persistent, single-node MongoDB replica set and Express serving the built React app. It binds published ports to localhost. The bundled unauthenticated MongoDB container is for local development only.

## Development without Docker

Use Node 22 or newer and npm.

```bash
npm ci
cp .env.example .env
```

Either point `MONGODB_URI` at an authenticated MongoDB replica set (for example your Atlas database) and run:

```bash
npm run dev:server
```

Or start a local development MongoDB replica set plus API:

```bash
npm run dev:local
```

In a second terminal:

```bash
npm run dev
```

Open **http://localhost:4173**. Vite proxies `/api` to Express on port 4000. `dev:local` uses the official MongoDB binary through mongodb-memory-server and stores local data in `.local-data/mongo`; the first run may download the binary. Environments that block MongoDB processes should use Docker or an external replica set.

Optional sample data:

```bash
npm run dev:local -- --seed
```

The seed creates a `learner` account with a randomly generated development password printed locally. Set `SEED_PASSWORD` to choose one. Seeding does not overwrite existing folders and is refused in production.

To run only the temporary UI preview:

```bash
VITE_DEMO_MODE=true npm run dev
```

Do not set `VITE_DEMO_MODE=true` for the real application. If switching from preview development, remove that value from `.env.local`.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `server/src/models` | MongoDB schemas, indexes, and relationships |
| `server/src/controllers` | HTTP request/response handling |
| `server/src/services` | Business rules, transactions, access, scheduling |
| `server/src/routes` | Endpoint mapping and input validation |
| `server/src/middleware` | Authentication, validation, and cross-cutting concerns |
| `server/src/extensions` | Disabled future AI/RAG integration port |
| `client/src/pages` | Route-level views |
| `client/src/components` | Reusable presentation and interaction components |
| `client/src/hooks` | App/session state and data-loading hooks |
| `client/src/services` | API client, explicitly isolated preview adapter |
| `shared` | Authored sample learning content |

The backend follows MVC with a service layer: routes call controllers, controllers delegate business logic to services, and services use Mongoose models. JSON is the API view; React supplies the user interface. React separates page views and reusable components from state hooks and service access.

Design principles: one responsibility per layer, authorization on the server, explicit dependencies, reusable UI primitives, and extension ports that do not add unused infrastructure.

## Data and concurrency rules

- A unique database index, not a preflight availability check, guarantees username uniqueness. Usernames normalize to lowercase.
- Folder-scoped writes execute in MongoDB transactions and also update the folder access document. Revocations and concurrent mutations therefore serialize on that document.
- Folder and card edits carry a `version`. A stale edit returns HTTP 409 without replacing the current content.
- Reviews use a unique `(user, requestId)` key plus a progress version. Retrying the same request returns its prior result; different concurrent reviews with an old progress version conflict.
- Each learner has their own `(user, card)` progress record. Collaboration never shares study ratings.
- Read access to private folders and their images is checked on each API request. Images use `Cache-Control: private, no-store`.
- Public folder responses hide private membership lists from nonmembers. Permission is never derived from a shared URL.
- Copies duplicate referenced media, so the copy does not depend on access to the original folder.
- Version history records the previous card snapshot. Restoring loads it as a draft; saving creates another version.

A MongoDB replica set is required for transactions. These safeguards have targeted integration tests; see TESTING.md for the verification status in the build environment.

## Deployment

Only **a Node-compatible host and MongoDB** are required. Redis, a vector database, email, S3, and paid AI services are not required for v1. Fonts and UI assets are bundled locally.

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

The standard build explicitly disables demo mode. Express serves the React build and API from the same origin, which is the recommended deployment layout. Configure:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Authenticated replica-set connection string; keep server-side |
| `CLIENT_ORIGIN` | Exact trusted browser origin, e.g. `https://recall.example.com` |
| `PORT` | Server port; default 4000 |
| `NODE_ENV` | Set to `production` behind HTTPS for secure session cookies |
| `TRUST_PROXY` | Set to `1` only behind exactly one trusted reverse proxy |
| `VITE_API_URL` | Optional API origin when building a separately hosted frontend |
| `READINESS_TIMEOUT_MS` | Max wait for the MongoDB ping in `GET /api/ready`; default 2000 |
| `HEALTHCHECK_URL` | Used only by `scripts/healthcheck.js` on the monitoring machine, never by the server |

For separate frontend/API hosting, use the same site (for example `app.example.com` and `api.example.com`) because session cookies use SameSite=Lax. Configure the exact frontend origin in CORS and rebuild with the API origin. Do not expose database credentials using any `VITE_` variable.

The Dockerfile builds the real app, not the preview. Use HTTPS at your host or reverse proxy and an authenticated database for a live service. The included Compose file is a development configuration, not an internet-facing production topology.

## Health monitoring

Recall exposes two public, unauthenticated endpoints. Neither returns connection strings, error messages, or other internals.

| Endpoint | Meaning | Response |
| --- | --- | --- |
| `GET /api/health` | **Liveness** — the Express process is up and serving requests. Does not touch MongoDB. | Always `200 {"ok":true,"app":"recall","storage":"mongodb"}` |
| `GET /api/ready` | **Readiness** — the app can serve real traffic. Pings MongoDB with a short timeout (`READINESS_TIMEOUT_MS`, default 2 s). | `200 {"ok":true,"status":"ready",...}` or `503 {"ok":false,"status":"unavailable",...}` |

Use liveness to detect a crashed or sleeping process (and to wake an idle host). Use readiness to decide whether the instance should receive traffic — a load balancer, orchestrator, or uptime monitor should alert on readiness, because a live process with an unreachable database still fails every real request. Both routes are mounted before session handling, so a stale cookie never causes a database lookup.

Local check while the dev server is running:

```bash
curl -i http://localhost:4000/api/health
curl -i http://localhost:4000/api/ready
HEALTHCHECK_URL=http://localhost:4000/api/health npm run healthcheck   # exits 0
HEALTHCHECK_URL=http://localhost:4999/api/health npm run healthcheck   # exits 1 after one retry
```

### Scheduled external pings

`scripts/healthcheck.js` is a standalone Node 22+ script (built-in `fetch`, no dependencies). It calls `HEALTHCHECK_URL` once with a 10-second timeout, retries at most once, prints a timestamped line per attempt, and exits `0` healthy / `1` unhealthy / `2` misconfigured. Run it every 5 minutes from a machine that is **independent of the Recall host** — a home server, a VPS, a CI runner — so the schedule keeps firing while Recall is asleep or down. Ready-made configurations live in `scheduling/` (cron, systemd timer, GitHub Actions example); see `docs/MONITORING.md` for setup steps.

Recall deliberately does **not** ping itself with `setInterval` or `node-cron`: a sleeping host cannot run its own timer, and a self-ping only proves the process can reach itself. Scheduled external requests can reduce idle shutdowns on free-tier hosts, but they do not guarantee uptime, do not bypass hosting usage limits or instance-hour caps, and may themselves be delayed by the scheduler. Treat them as best-effort signal, not as an SLA.

An external HTTP monitoring service (for example UptimeRobot, Better Stack, Healthchecks.io, Pingdom, or a cloud provider's uptime check) can call `https://<your-host>/api/health` directly on a 5-minute interval and alert when it stops returning HTTP 200 — no script or scheduler is needed. Point a second check at `/api/ready` to catch database outages. Nothing in this repository provisions, pays for, or deploys such a service.

## Future AI and RAG

`KnowledgeProvider` defines disabled indexing/retrieval methods. The `DomainEvent` outbox is committed with card changes. A later indexer can read committed events, fetch authoritative cards, and create embeddings without slowing card writes. No event consumer, AI model, embeddings, or vector service runs in this version.

Before enabling RAG, enforce folder access again during retrieval, process privacy changes and deletions, index card versions, and remove stale vectors. A vector index must never become an authorization source. Treat retrieved card text as untrusted data.

## Scope and limits

- Collaboration is conflict-aware editing plus polling, not simultaneous character-level editing or live cursors.
- Folder queries return up to 200 collections; large-scale cursor pagination and indexed search are future work.
- Rate limiting is per Node process. Multiple replicas should share a Redis-backed limit store or use an edge gateway.
- Image documents are capped at 3 MB after processing. Object storage, total-user quotas, and orphan-media cleanup are future scaling work.
- Public account recovery, email verification, moderation/reporting, data export, and account deletion are not implemented in v1.
- Cards use plain text; rich text, nested folders, import/export, reminders, and offline synchronization are not implemented.
- Scheduling uses a documented simple interval algorithm, not an implementation of FSRS or a claim of optimal retention.
- UTC defines daily-goal boundaries.

## Commands

```bash
npm test                  # Core checks; database integration cases reported as skipped
npm run test:integration  # Real MongoDB replica-set integration tests
npm run build             # Real API-backed React build
npm run build:preview     # Explicit in-memory UI preview build
npm run healthcheck       # One external liveness ping of HEALTHCHECK_URL; exit 0/1/2
```

Integration tests use a newly named temporary database and delete only that database on completion. `TEST_MONGODB_URI` can point at a test replica set if a local MongoDB process is unavailable.
