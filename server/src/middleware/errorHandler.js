import crypto from 'node:crypto';
import { toAppError, notFound, GENERIC } from '../utils/errors.js';
import { logger, runWithContext, currentContext } from '../utils/logger.js';

const SAFE_ID = /^[\w-]{1,64}$/;

/** Gives every request an id, echoes it back, and puts it in scope for anything logged downstream. */
export const requestContext = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = SAFE_ID.test(incoming || '') ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  runWithContext({ requestId: req.id }, next);
};

export const notFoundHandler = (req, _res, next) => next(notFound(`No endpoint for ${req.method} ${req.path}.`, 'NO_ROUTE'));

/**
 * The single exit point for every failure. Express calls it for thrown and forwarded errors alike;
 * `toAppError` decides what the failure means, and only exposed messages reach the client.
 */
export function errorHandler(err, req, res, _next) {
  const error = toAppError(err);
  const fields = { status: error.status, code: error.code, method: req.method, path: req.originalUrl?.split('?')[0], userId: req.user?.id };

  if (error.status >= 500) {
    const cause = error.cause || err;
    logger.error(cause?.message || error.message, { ...fields, stack: cause?.stack });
  } else if (error.status === 429 || error.status === 403) {
    logger.warn(error.message, fields);
  } else {
    logger.debug(error.message, fields);
  }

  if (res.headersSent) return req.destroy?.();
  const body = { error: error.expose ? error.message : GENERIC, code: error.code, requestId: req.id || currentContext().requestId };
  if (error.details) body.details = error.details;
  res.status(error.status).json(body);
}

/** Last line of defence: a crash in a callback that Express never sees still gets logged, once. */
export function installProcessHandlers({ onFatal } = {}) {
  const handle = kind => reason => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`${kind}: ${error.message}`, { kind, stack: error.stack });
    if (kind === 'uncaughtException') onFatal?.(error);
  };
  process.on('unhandledRejection', handle('unhandledRejection'));
  process.on('uncaughtException', handle('uncaughtException'));
}
