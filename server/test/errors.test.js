import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AppError, toAppError, badRequest, notFound, GENERIC } from '../src/utils/errors.js';

test('an AppError keeps its status, code, and exposability', () => {
  const error = badRequest('Pick a plan.', 'NO_PLAN');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'NO_PLAN');
  assert.equal(error.expose, true);
  assert.equal(toAppError(error), error, 'an AppError passes through untouched');
  assert.equal(notFound().code, 'NOT_FOUND', 'the code defaults from the status');
});

test('a Zod failure becomes a 400 naming the first bad field', () => {
  const parsed = z.object({ email: z.email() }).safeParse({ email: 'nope' });
  const error = toAppError(parsed.error);
  assert.equal(error.status, 400);
  assert.equal(error.code, 'VALIDATION_FAILED');
  assert.equal(error.details.field, 'email');
  assert.match(error.message, /email/);
});

test('mongo and multer failures are translated, not leaked', () => {
  const duplicate = toAppError(Object.assign(new Error('E11000 dup key'), { code: 11000, keyPattern: { username: 1 } }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.details.field, 'username');
  assert.doesNotMatch(duplicate.message, /E11000/, 'the raw driver message never reaches the client');

  assert.equal(toAppError(Object.assign(new Error('x'), { name: 'CastError' })).status, 404);
  assert.equal(toAppError(Object.assign(new Error('x'), { name: 'VersionError' })).code, 'STALE_VERSION');
  assert.equal(toAppError(Object.assign(new Error('x'), { code: 'LIMIT_FILE_SIZE' })).status, 413);
  assert.equal(toAppError(Object.assign(new SyntaxError('bad json'), { body: '{' })).code, 'BAD_JSON');
});

test('an unexpected throw is a 500 whose message is never shown to the user', () => {
  const secret = new Error('mongodb://admin:hunter2@cluster0/recall timed out');
  const error = toAppError(secret);
  assert.equal(error.status, 500);
  assert.equal(error.expose, false);
  assert.equal(error.message, GENERIC);
  assert.equal(error.cause, secret, 'the original is kept for the log, not the response');
  assert.equal(toAppError('a string').status, 500);
  assert.equal(toAppError(undefined).status, 500);
});

test('a thrown value that already carries an http status keeps it', () => {
  const roomFull = Object.assign(new Error('This room is full.'), { status: 409 });
  assert.equal(toAppError(roomFull).status, 409);
  assert.equal(toAppError(roomFull).message, 'This room is full.');
  const upstream = Object.assign(new Error('gateway exploded'), { status: 502 });
  assert.equal(toAppError(upstream).message, GENERIC, 'server-side statuses still get a generic message');
  assert.equal(toAppError(Object.assign(new Error('x'), { status: 99 })).status, 500, 'a nonsense status is a bug');
});

test('AppError subclasses Error so instanceof and stacks still work', () => {
  const error = new AppError(403, 'Nope.', 'FORBIDDEN');
  assert.ok(error instanceof Error);
  assert.ok(error.stack.includes('errors.test.js'));
});
