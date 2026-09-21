import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { allModels, Review } from '../src/models/index.js';
const enabled = process.env.RUN_INTEGRATION === '1';
let mongo, app, owner, editor, outsider, folderId, cardId;
const password = 'Integration-only-password-2026';
before(async () => {
  if (!enabled) return;
  const dbName = `recall_test_${crypto.randomBytes(6).toString('hex')}`;
  if (!process.env.TEST_MONGODB_URI) mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(process.env.TEST_MONGODB_URI || mongo.getUri(), { dbName });
  await Promise.all(allModels.map(m => m.init())); app = createApp();
  [owner, editor, outsider] = [request.agent(app), request.agent(app), request.agent(app)];
  for (const [agent, username] of [[owner, 'owner'], [editor, 'editor'], [outsider, 'outsider']]) { const r = await agent.post('/api/auth/signup').send({ username, name: username, email: `${username}@example.test`, password }); assert.equal(r.status, 201, JSON.stringify(r.body)); }
  const f = await owner.post('/api/folders').send({ title: 'Concurrency', visibility: 'private' }); assert.equal(f.status, 201); folderId = f.body.folder.id;
  const c = await owner.post(`/api/folders/${folderId}/cards`).send({ front: { text: 'Q' }, back: { text: 'A' } }); assert.equal(c.status, 201); cardId = c.body.card.id;
});
after(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } if (mongo) await mongo.stop(); });
const integration = (name, fn) => test(name, { skip: !enabled }, fn);
integration('private folders and media stay private, public access is revoked immediately', async () => {
  assert.equal((await outsider.get(`/api/folders/${folderId}`)).status, 404);
  assert.equal((await request(app).get(`/api/folders/${folderId}/cards`)).status, 404);
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#6545d1' } }).png().toBuffer();
  const image = await owner.post(`/api/folders/${folderId}/images`).attach('image', png, 'test.png'); assert.equal(image.status, 201, JSON.stringify(image.body));
  assert.equal((await outsider.get(`/api/media/${image.body.id}`)).status, 404);
  assert.equal((await owner.get(`/api/media/${image.body.id}`)).headers['cache-control'], 'private, no-store');
  let f = (await owner.get(`/api/folders/${folderId}`)).body.folder;
  let result = await owner.patch(`/api/folders/${folderId}`).send({ ...f, visibility: 'global', version: f.version }); assert.equal(result.status, 200);
  assert.equal((await request(app).get(`/api/media/${image.body.id}`)).status, 200);
  f = result.body.folder; await owner.patch(`/api/folders/${folderId}`).send({ ...f, visibility: 'private', version: f.version });
  assert.equal((await request(app).get(`/api/media/${image.body.id}`)).status, 404);
});
integration('viewers cannot edit; editors can edit; revocation stops later writes', async () => {
  assert.equal((await owner.post(`/api/folders/${folderId}/members`).send({ username: 'editor', role: 'viewer' })).status, 200);
  const body = { front: { text: 'Edited' }, back: { text: 'Answer' }, version: 0 };
  assert.equal((await editor.patch(`/api/cards/${cardId}`).send(body)).status, 403);
  await owner.post(`/api/folders/${folderId}/members`).send({ username: 'editor', role: 'editor' });
  assert.equal((await editor.patch(`/api/cards/${cardId}`).send(body)).status, 200);
  await owner.post(`/api/folders/${folderId}/members`).send({ username: 'editor', role: 'remove' });
  assert.equal((await editor.patch(`/api/cards/${cardId}`).send({ ...body, version: 1 })).status, 404);
});
integration('only one simultaneous edit wins; old version is preserved', async () => {
  const current = (await owner.get(`/api/folders/${folderId}/cards`)).body.cards.find(c => c.id === cardId);
  const body = { front: { text: 'Concurrent question' }, back: { text: 'Answer' }, version: current.version };
  const results = await Promise.all([owner.patch(`/api/cards/${cardId}`).send(body), owner.patch(`/api/cards/${cardId}`).send(body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.ok((await owner.get(`/api/cards/${cardId}/revisions`)).body.revisions.length >= 1);
});
integration('retries count as one review; different concurrent reviews conflict', async () => {
  const body = { cardId, rating: 'good', requestId: crypto.randomUUID(), version: 0 };
  const results = await Promise.all([owner.post('/api/reviews').send(body), owner.post('/api/reviews').send(body)]);
  assert.deepEqual(results.map(r => r.status), [200, 200]); assert.equal(await Review.countDocuments({ requestId: body.requestId }), 1);
  const version = results[0].body.progress.version;
  const parallel = await Promise.all(['hard', 'easy'].map(rating => owner.post('/api/reviews').send({ cardId, rating, requestId: crypto.randomUUID(), version })));
  assert.deepEqual(parallel.map(r => r.status).sort(), [200, 409]);
});
integration('usernames are unique even with concurrent registration and capitalization', async () => {
  const results = await Promise.all(['UniqueLearner', 'uniquelearner'].map((username, i) => request(app).post('/api/auth/signup').send({ username, name: 'Test', email: `unique${i}@example.test`, password })));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
});
integration('private copies own their image data after access to the source is revoked', async () => {
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#8162d7' } }).png().toBuffer();
  const image = await owner.post(`/api/folders/${folderId}/images`).attach('image', png, 'copy-test.png'); assert.equal(image.status, 201);
  const imageCard = await owner.post(`/api/folders/${folderId}/cards`).send({ front: { text: 'Copy this image', image: image.body.id }, back: { text: 'An independent image copy' } }); assert.equal(imageCard.status, 201);
  await owner.post(`/api/folders/${folderId}/members`).send({ username: 'editor', role: 'viewer' });
  const r = await editor.post(`/api/folders/${folderId}/copy`); assert.equal(r.status, 201); assert.equal(r.body.folder.visibility, 'private'); assert.equal(r.body.folder.role, 'owner');
  await owner.post(`/api/folders/${folderId}/members`).send({ username: 'editor', role: 'remove' });
  const copied = await editor.get(`/api/folders/${r.body.folder.id}/cards`); assert.equal(copied.status, 200);
  const copiedImage = copied.body.cards.find(c => c.front.text === 'Copy this image').front.image;
  assert.notEqual(copiedImage, image.body.id);
  assert.equal((await editor.get(`/api/media/${copiedImage}`)).status, 200);
  assert.equal((await editor.get(`/api/media/${image.body.id}`)).status, 404);
});
