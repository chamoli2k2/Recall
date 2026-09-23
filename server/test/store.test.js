import test from 'node:test';
import assert from 'node:assert/strict';
import { load, peek, put, invalidate, register, subscribe, reset } from '../../client/src/services/store.js';

/** A loader that records how often it actually ran and resolves when we say so. */
function counter(value = 'ok') {
  const state = { calls: 0, release: null };
  state.loader = () => { state.calls++; return new Promise(resolve => { state.release = () => resolve(value); }); };
  return state;
}

test('two callers asking at the same moment share one request', async () => {
  reset();
  const c = counter();
  const a = load('/folders', c.loader);
  const b = load('/folders', c.loader);
  assert.equal(c.calls, 1, 'the second caller should join the first request');
  c.release();
  await Promise.all([a, b]);
  assert.equal(peek('/folders').data, 'ok');
});

test('a second load after the first settles does refetch', async () => {
  reset();
  const c = counter();
  const first = load('/stats', c.loader); c.release(); await first;
  const second = load('/stats'); c.release(); await second;
  assert.equal(c.calls, 2);
});

test('invalidate reloads what is on screen and drops what is not', async () => {
  reset();
  const watched = counter('watched'), ignored = counter('ignored');
  const a = load('/teams', watched.loader); watched.release(); await a;
  const b = load('/me/friends', ignored.loader); ignored.release(); await b;

  subscribe('/teams', () => {});
  invalidate();
  assert.equal(watched.calls, 2, 'a subscribed key reloads');
  assert.equal(ignored.calls, 1, 'an unsubscribed key is only dropped');
  assert.equal(peek('/me/friends'), null);
  watched.release();
});

test('invalidate takes a prefix so one folder does not reload the world', async () => {
  reset();
  const folder = counter(), teams = counter();
  register('/folders/abc', folder.loader); register('/teams', teams.loader);
  subscribe('/folders/abc', () => {}); subscribe('/teams', () => {});

  invalidate('/folders/abc');
  assert.equal(folder.calls, 1);
  assert.equal(teams.calls, 0, 'an unrelated key is left alone');
  folder.release();
});

test('invalidating mid-flight refetches once the running load lands', async () => {
  reset();
  const c = counter();
  subscribe('/teams', () => {});
  const running = load('/teams', c.loader);
  invalidate('/teams');
  assert.equal(c.calls, 1, 'no second request while one is already running');
  c.release();
  await running;
  await Promise.resolve();
  assert.equal(c.calls, 2, 'the stale result is replaced once the first lands');
  c.release();
});

test('a failed load records the message instead of rejecting', async () => {
  reset();
  await load('/stats', () => Promise.reject(new Error('nope')));
  assert.equal(peek('/stats').error.message, 'nope');
  assert.equal(peek('/stats').data, null);
});

test('a failure keeps the data that was already there', async () => {
  reset();
  put('/teams', { teams: [1] });
  await load('/teams', () => Promise.reject(new Error('offline')));
  assert.deepEqual(peek('/teams').data, { teams: [1] });
});

test('subscribers hear about every settled load', async () => {
  reset();
  let heard = 0;
  subscribe('/stats', () => { heard++; });
  await load('/stats', () => Promise.resolve(1));
  assert.equal(heard, 1);
  put('/stats', 2);
  assert.equal(heard, 2, 'a direct write notifies too');
});
