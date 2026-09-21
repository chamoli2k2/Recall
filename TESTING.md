# Verification status

## `npm test` (no database required)

- Core tests: scheduling boundaries, private/global role rules, input validation, normalized usernames, unsafe URL rejection, API health, unauthenticated write rejection, cross-origin write rejection, and unknown endpoint handling.
- Health monitoring tests (`server/test/health.test.js`): `/api/health` returns 200 with no database and does not wait on Mongoose buffering even when a session cookie is sent; `/api/ready` returns 503 with a safe body when MongoDB is unavailable; the readiness ping honours its timeout; `scripts/healthcheck.js` exits 0 on HTTP 200, retries exactly once and exits 1 on non-200, redirect, timeout, and connection-refused outcomes, and exits 2 when `HEALTHCHECK_URL` is missing.
- Realtime unit tests (`server/test/realtime.test.js`): the post-commit event bus publishes only on flush and a retried transaction attempt discards earlier queued events; `PresenceStore` dedupes tabs per user, tracks editing intent, and removes a dropped socket from every room; `DocStore` seeds a Yjs document from the card, merges concurrent updates from two clients to the same text, persists on the last release, restores persisted CRDT state when it is newer than the card, and re-seeds from the card when the card was edited after the last CRDT persist.

## `npm run test:integration` (starts an in-memory MongoDB replica set, or uses `TEST_MONGODB_URI`)

Verified passing on macOS with `mongodb-memory-server` 7.0.

- `server/test/integration.test.js`: private image access and visibility changes, viewer/editor authorization and revocation, concurrent card updates (one 200, one 409), review idempotency and conflicting reviews, username uniqueness races, and independent private copies.
- `server/test/realtime.integration.test.js`, using real Socket.IO clients and HTTP sessions:
  - the handshake rejects an untrusted cross-origin `Origin` and accepts same-origin;
  - `folder:join` enforces the same access rules as HTTP (outsider and anonymous refused on a private folder), and presence updates as people join, mark a card as editing, and disconnect;
  - a committed `PATCH /cards/:id` is pushed to the room with the actor and the new version, and a `409` write broadcasts nothing;
  - two editors co-edit through the shared CRDT document (concurrent inserts converge on both clients and on the server), cursor awareness is relayed, viewers are refused `doc:join`, the merged text saves through HTTP into the versioned card, the document is evicted when the last editor leaves and its state is persisted;
  - revoking a member emits `folder:revoked`, removes them from presence and open documents, and later events are not delivered to them.

## Browser verification

Two users on one folder (one in the browser, one simulated with `node scripts/collab-peer.js <folderId> <username> <password> --type "text"`): the presence stack shows the other user with their colour, the card shows an "editing" badge with their name, the card editor switches to live mode ("Live · 1 other editing"), the other user's typing and coloured cursor appear character by character, saving writes the merged text (both users' edits) into the card, and a card created by the other user appears with a toast without a refresh.

## `npm run test:e2e` (Playwright, real browser)

`playwright.config.js` starts `scripts/e2e-server.js`, which boots a throwaway in-memory MongoDB replica set and the API serving the built client on port 4100 (run `npm run build` first; `npx playwright install chromium` once). Each test signs up fresh accounts through the API and drives the UI in Chromium; multi-user tests use separate browser contexts.

- `e2e/learning.spec.js`: sign-up through the form; a Markdown + LaTeX + cloze card authored in the editor (preview shows blanks and KaTeX output), rendered in the folder grid, flipped to reveal the answer, then studied with FSRS interval previews on the rating buttons; CSV import with dry-run preview and JSON/CSV export; the Progress page's retention panel, heatmap and streak after a review.
- `e2e/collaboration.spec.js`: two browsers on one folder see each other's presence, a card created by one appears on the other with a toast, both open the same card and type concurrently through the CRDT editor (text converges, the remote cursor shows the peer's name), the merged text saves through the versioned API; revoking access ejects the collaborator to the library with a message.
- `e2e/quiz.spec.js`: host sets up a quiz from the folder menu, a friend joins by code, both lobbies list both players, only the host can start, an answer locks in, the round reveals early when everyone has answered with correct/wrong highlighting and a leaderboard, an unanswered round times out on the server, and the podium ranks the winner. Signed-out invite links redirect through login and back to the room.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: unit tests, API + realtime integration tests, the Playwright suite (with the HTML report and traces uploaded on failure), and a Docker image build. The mongod binary used by `mongodb-memory-server` is cached between runs.
