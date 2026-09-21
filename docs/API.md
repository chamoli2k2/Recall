# API overview

All routes use the `/api` prefix. The browser sends the HttpOnly `recall_session` cookie automatically. Server errors return `{ "error": "message", "code": "optional code" }`.

| Method | Route | Access / purpose |
| --- | --- | --- |
| POST | `/auth/signup` | Create account; name, username, email, password |
| POST | `/auth/login` | identifier (username/email), password |
| POST | `/auth/logout` | End current session |
| GET | `/auth/me` | Current user, or null |
| PATCH | `/auth/profile` | Own name, bio, dailyGoal |
| GET | `/users/:username` | Public profile and global folders only |
| GET | `/folders` | Own/shared/saved accessible collections |
| GET | `/folders?scope=explore` | Public discovery |
| GET | `/folders/archived` | Own archived folders |
| POST | `/folders` | Create own folder |
| GET | `/folders/:id` | Reader permission |
| PATCH | `/folders/:id` | Owner; full editable folder fields + version |
| POST | `/folders/:id/members` | Owner; username and viewer/editor/remove role |
| POST | `/folders/:id/copy` | Signed-in reader; independent private copy |
| PATCH | `/folders/:id/archive` | Owner; archived boolean |
| PATCH | `/folders/:id/save` | Reader; saved boolean |
| GET | `/folders/:id/activity` | Member-only activity details |
| GET | `/folders/:id/cards` | Reader; includes only caller’s progress |
| POST | `/folders/:id/cards` | Editor/owner |
| POST | `/folders/:id/images` | Editor/owner; multipart field `image` |
| GET | `/media/:id` | Reader permission on the parent folder |
| PATCH | `/cards/:id` | Editor/owner; full card fields + version |
| DELETE | `/cards/:id` | Editor/owner; permanent deletion |
| GET | `/cards/:id/revisions` | Editor/owner |
| PATCH | `/cards/:id/bookmark` | Reader; own bookmarked boolean |
| POST | `/reviews` | Reader; cardId, rating, requestId UUID, progress version |
| GET | `/stats` | Own study statistics |
| GET | `/health` | Liveness: Express is running. Public, no database access, always 200 |
| GET | `/ready` | Readiness: MongoDB answers a ping within `READINESS_TIMEOUT_MS`. 200 ready / 503 unavailable; no error details |

## Create a card

```json
{
  "front": { "text": "What is optimistic concurrency?", "image": null },
  "back": { "text": "Checking a version before committing an update.", "image": null },
  "tags": ["concurrency", "databases"],
  "hint": "Think about conflicting edits.",
  "source": ""
}
```

Both sides need text or an image. Each image ID must belong to the target folder. Folder identity comes from the route and cannot be replaced through card input.

## Version conflict

Edits and reviews can return `409` with `VERSION_CONFLICT`. Preserve the local draft and fetch the current version. Do not silently retry a stale edit as an overwrite.

For retrying a review after a network error, reuse the same request ID and the same payload. A different review requires a new request ID and the latest progress version.
