import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { beginCollecting, queueEvent, flushEvents, onEvent } from '../src/realtime/bus.js';
import { PresenceStore, colorFor } from '../src/realtime/presence.js';
import { DocStore } from '../src/realtime/docs.js';
test('event bus publishes only after flush, and a retried transaction attempt discards earlier queued events', () => {
  const seen = []; const off = onEvent(e => seen.push(e.type));
  const attempt1 = {}; beginCollecting(attempt1); queueEvent(attempt1, { type: 'card.created' });
  assert.deepEqual(seen, [], 'nothing is visible before commit');
  beginCollecting(attempt1); queueEvent(attempt1, { type: 'card.updated' }); // transaction retried: collection reset
  assert.deepEqual(flushEvents(attempt1).map(e => e.type), ['card.updated']);
  assert.deepEqual(seen, ['card.updated']);
  assert.deepEqual(flushEvents(attempt1), [], 'flush is idempotent');
  queueEvent({}, { type: 'ignored' }); // session that never began collecting is a no-op
  off();
});
test('presence dedupes tabs per user, tracks editing intent, and drops sockets from every room', () => {
  const p = new PresenceStore(); const ana = { id: 'u1', name: 'Ana', username: 'ana' }, bo = { id: 'u2', name: 'Bo', username: 'bo' };
  p.join('f1', 's1', ana); p.join('f1', 's2', ana); p.join('f1', 's3', bo); p.join('f2', 's3', bo);
  assert.equal(p.list('f1').length, 2); assert.equal(p.list('f1').find(e => e.user.id === 'u1').tabs, 2);
  assert.equal(p.setEditing('f1', 's2', 'card9'), true); assert.equal(p.list('f1').find(e => e.user.id === 'u1').editing, 'card9');
  assert.equal(p.setEditing('f1', 'nope', 'card9'), false);
  assert.equal(colorFor('u1'), colorFor('u1')); assert.match(colorFor('u1'), /^#[0-9a-f]{6}$/);
  assert.deepEqual(p.drop('s3').sort(), ['f1', 'f2']); assert.equal(p.list('f2').length, 0); assert.equal(p.list('f1').length, 1);
  p.leave('f1', 's1'); p.leave('f1', 's2'); assert.deepEqual(p.list('f1'), []); assert.equal(p.rooms.size, 0);
});
test('doc store seeds from the card, merges concurrent CRDT updates, persists on release, and prefers fresher persisted state', async () => {
  const saved = new Map(); const store = new DocStore({ load: async id => saved.get(id) || null, save: async (id, state) => { saved.set(id, { state, updatedAt: new Date() }); }, debounceMs: 5 });
  const card = { front: { text: 'Hello' }, back: { text: '' }, updatedAt: new Date(Date.now() - 1000) };
  const server = await store.acquire('c1', card); assert.equal(server.getText('front').toString(), 'Hello');
  // Two clients start from the same state and type concurrently at different positions.
  const a = new Y.Doc(), b = new Y.Doc(); const base = Y.encodeStateAsUpdate(server); Y.applyUpdate(a, base); Y.applyUpdate(b, base);
  const updates = []; a.on('update', u => updates.push(u)); b.on('update', u => updates.push(u));
  a.getText('front').insert(5, ' world'); b.getText('front').insert(0, 'Oh, ');
  for (const u of updates) assert.equal(store.apply('c1', u), true);
  assert.equal(store.text('c1', 'front'), 'Oh, Hello world');
  assert.equal(store.apply('missing', updates[0]), false);
  await store.acquire('c1', card); await store.release('c1'); assert.equal(saved.has('c1'), false, 'still referenced: not evicted yet');
  await store.release('c1'); assert.ok(saved.get('c1')?.state?.length > 0, 'persisted on last release'); assert.equal(store.docs.size, 0);
  // Reopening restores the merged CRDT state when it is newer than the card…
  const reopened = await store.acquire('c1', card); assert.equal(reopened.getText('front').toString(), 'Oh, Hello world'); await store.release('c1');
  // …but a card edited after the last CRDT persist wins, so solo/offline edits are never overwritten.
  const newer = await store.acquire('c1', { ...card, front: { text: 'Rewritten' }, updatedAt: new Date(Date.now() + 60_000) }); assert.equal(newer.getText('front').toString(), 'Rewritten'); await store.release('c1');
});
