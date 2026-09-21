import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { schedule } from '../src/services/studyService.js';
import { roleOf } from '../src/services/accessService.js';
import { cardSchema, usernameSchema } from '../src/middleware/validate.js';
import { createApp } from '../src/app.js';
test('a forgotten card returns after ten minutes; hard cannot reduce the interval below one day', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const again = schedule({ interval: 30, repetitions: 5, ease: 1.3 }, 'again', now);
  assert.equal(again.dueAt.toISOString(), '2026-01-01T00:10:00.000Z'); assert.equal(again.repetitions, 0); assert.equal(again.ease, 1.3);
  assert.equal(schedule({ interval: 0, repetitions: 0 }, 'hard', now).interval, 1);
  assert.equal(schedule({ interval: 0, repetitions: 0 }, 'good', now).interval, 1);
  assert.equal(schedule({ interval: 1, repetitions: 1 }, 'good', now).interval, 3);
});
test('private/public visibility and explicit roles do not grant editor access to strangers', () => {
  const folder = { owner: 'owner', visibility: 'private', members: [{ user: 'editor', role: 'editor' }, { user: 'reader', role: 'viewer' }] };
  assert.equal(roleOf(folder, 'owner'), 'owner'); assert.equal(roleOf(folder, 'editor'), 'editor'); assert.equal(roleOf(folder, 'reader'), 'viewer'); assert.equal(roleOf(folder, 'stranger'), null); assert.equal(roleOf(folder, null), null);
  assert.equal(roleOf({ ...folder, visibility: 'global' }, 'stranger'), 'viewer');
});
test('card validation rejects empty sides and unsafe sources; usernames normalize', () => {
  assert.equal(usernameSchema.parse(' Learner_1 '), 'learner_1');
  assert.throws(() => cardSchema.parse({ front: { text: '' }, back: { text: 'answer' } }));
  assert.throws(() => cardSchema.parse({ front: { text: 'question' }, back: { text: 'answer' }, source: 'javascript:alert(1)' }));
  const card = cardSchema.parse({ front: { text: 'Q' }, back: { text: 'A' }, tags: [' React ', 'react'] }); assert.deepEqual(card.tags, ['react']);
});
test('API health, anonymous writes, untrusted origins and input validation', async () => {
  const app = createApp();
  assert.equal((await request(app).get('/api/health')).body.storage, 'mongodb');
  assert.equal((await request(app).post('/api/folders').send({ title: 'No auth' })).status, 401);
  assert.equal((await request(app).post('/api/auth/signup').set('Origin', 'https://untrusted.example').send({})).status, 403);
  assert.equal((await request(app).post('/api/auth/signup').send({ username: 'x' })).status, 400);
  assert.equal((await request(app).get('/api/unknown')).status, 404);
});
