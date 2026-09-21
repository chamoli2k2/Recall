# Verification status

## Executed in the build environment

- Production React compilation.
- Preview React compilation.
- Core tests: scheduling boundaries, private/global role rules, input validation, normalized usernames, unsafe URL rejection, API health, unauthenticated write rejection, cross-origin write rejection, and unknown endpoint handling.
- Health monitoring tests (`server/test/health.test.js`): `/api/health` returns 200 with no database and does not wait on Mongoose buffering even when a session cookie is sent; `/api/ready` returns 503 with a safe body when MongoDB is unavailable; the readiness ping honours its timeout; `scripts/healthcheck.js` exits 0 on HTTP 200, retries exactly once and exits 1 on non-200, redirect, timeout, and connection-refused outcomes, and exits 2 when `HEALTHCHECK_URL` is missing. These run without a database as part of `npm test`.
- Browser checks of the sample frontend: create a private folder; create a two-sided card with a tag; add a sample collaborator as editor; reveal an answer and complete a study session. These exercise the preview adapter, not MongoDB. Desktop layout inspected visually; mobile styles are implemented but a mobile browser session was not available.

## Database integration is blocked here

The MongoDB 7 process exits before database initialization with:

```text
std::exception in initAndListen: open: Operation not permitted
UnexpectedCloseError: Instance closed unexpectedly with code 100
```

`npm run test:integration` was attempted and its database setup failed. The six cases are **not verified passes**. `npm test` runs ten non-database checks and marks the six integration cases skipped unless explicitly enabled.

Run `npm run test:integration` on a host that permits MongoDB, or supply `TEST_MONGODB_URI` for a test replica set. The suite covers private image access and visibility changes, viewer/editor authorization and revocation, concurrent card updates, review idempotency and conflicting reviews, username uniqueness races, and independent private copies.

Docker startup and live multi-user collaboration could not be exercised here. Do not treat the interactive preview as proof of backend integration. Run the integration suite and verify two real user sessions before accepting a live deployment.
