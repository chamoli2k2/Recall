import { toast } from 'sonner';

/**
 * Mirrors the server envelope `{ error, code, requestId }`. Carrying the code means callers branch
 * on a stable string instead of matching message text, and the request id gives support something
 * to search for in the logs.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', requestId = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; this.code = code; this.requestId = requestId; this.details = details;
  }
  get isOffline() { return this.code === 'NETWORK'; }
  get needsSignIn() { return this.status === 401; }
  get needsPremium() { return this.status === 402 || this.code === 'PREMIUM_REQUIRED'; }
  get isConflict() { return this.status === 409; }
}

const FRIENDLY = {
  RATE_LIMITED: 'Too many requests. Give it a moment and try again.',
  DB_UNAVAILABLE: 'Recall cannot reach its database right now. Please try again shortly.',
  STALE_VERSION: 'Someone else changed this first. Reload and try again.',
};

/** The one place the app turns a caught error into something a person reads. */
export function messageFor(error) {
  if (!error) return 'Something went wrong. Please try again.';
  if (error instanceof ApiError) {
    if (error.isOffline) return 'You appear to be offline. Check your connection and try again.';
    return FRIENDLY[error.code] || error.message;
  }
  return error.message || 'Something went wrong. Please try again.';
}

/** Report a failure to the user and the console, with the request id attached for support. */
export function reportError(error, fallback) {
  const message = fallback && !(error instanceof ApiError) ? fallback : messageFor(error);
  const id = error instanceof ApiError ? error.requestId : null;
  toast.error(message, id ? { description: `Reference ${id}` } : undefined);
  if (!(error instanceof ApiError) || error.status >= 500 || error.isOffline) console.error('[recall]', error);
  return message;
}
