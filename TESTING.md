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
