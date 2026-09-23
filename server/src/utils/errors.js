/**
 * Every failure in the codebase becomes an AppError before it reaches the client.
 *
 * `status` is the HTTP code, `code` is a stable machine-readable string the frontend can branch on
 * (PREMIUM_REQUIRED, SEAT_LIMIT, …), and `expose` marks whether the message is safe to show a user.
 * Anything that is not an AppError is treated as a bug: it is logged with a stack and reported as a
 * generic 500, so an internal message or a database detail can never leak through an error response.
 */
export class AppError extends Error {
  constructor(status, message, code, { details, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code || CODE_BY_STATUS[status] || 'ERROR';
    this.expose = status < 500;
    if (details) this.details = details;
  }
}

const CODE_BY_STATUS = { 400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 402: 'PAYMENT_REQUIRED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'TOO_LARGE', 422: 'UNPROCESSABLE', 429: 'RATE_LIMITED', 500: 'INTERNAL' };

export const badRequest = (message, code, options) => new AppError(400, message, code, options);
export const unauthenticated = (message = 'Sign in to continue.', code, options) => new AppError(401, message, code, options);
export const forbidden = (message = 'You do not have access to this.', code, options) => new AppError(403, message, code, options);
export const notFound = (message = 'Not found.', code, options) => new AppError(404, message, code, options);
export const conflict = (message, code, options) => new AppError(409, message, code, options);
export const GENERIC = 'Something went wrong. Please try again.';
export const internal = (message = GENERIC, code, options) => new AppError(500, message, code, options);

export const assert = (condition, status, message, code, options) => { if (!condition) throw new AppError(status, message, code, options); };
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const first = issues => issues?.[0];
const zodMessage = issues => issues.map(i => i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message).join('; ');

/**
 * The one place that decides what any thrown value means. Express, Socket.IO, and background jobs
 * all funnel through here so a validation failure looks identical wherever it happened.
 */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (!err || typeof err !== 'object') return internal(undefined, undefined, { cause: err });

  // Zod: request bodies, query strings, and webhook payloads.
  if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    return new AppError(400, zodMessage(err.issues), 'VALIDATION_FAILED', { cause: err, details: { field: first(err.issues)?.path?.join('.') || null } });
  }
  // Mongo duplicate key: the unique indexes that enforce usernames, memberships, and idempotency.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || null;
    return new AppError(409, 'That record already exists.', 'DUPLICATE', { cause: err, details: { field } });
  }
  if (err.name === 'ValidationError' && err.errors) {
    const paths = Object.keys(err.errors);
    return new AppError(400, `Invalid ${paths.join(', ')}.`, 'VALIDATION_FAILED', { cause: err, details: { field: paths[0] } });
  }
  if (err.name === 'CastError') return new AppError(404, 'Record not found.', 'NOT_FOUND', { cause: err });
  if (err.name === 'VersionError') return new AppError(409, 'Someone else changed this first. Reload and try again.', 'STALE_VERSION', { cause: err });
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') return new AppError(503, 'The database is unavailable. Please try again shortly.', 'DB_UNAVAILABLE', { cause: err });

  // Multer: uploads.
  if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'That file is too large.', 'FILE_TOO_LARGE', { cause: err });
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return new AppError(400, 'Upload a single file.', 'BAD_UPLOAD', { cause: err });

  // express.json on a malformed body.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) return new AppError(400, 'The request body is not valid JSON.', 'BAD_JSON', { cause: err });
  if (err.type === 'entity.too.large') return new AppError(413, 'The request body is too large.', 'BODY_TOO_LARGE', { cause: err });

  // Anything with a plausible HTTP status already attached (http-errors, hand-rolled throws).
  const status = Number(err.status || err.statusCode);
  if (Number.isInteger(status) && status >= 400 && status <= 599) {
    return new AppError(status, status < 500 && err.message ? err.message : GENERIC, err.code, { cause: err });
  }

  return internal(undefined, undefined, { cause: err });
}
