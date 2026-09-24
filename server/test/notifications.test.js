import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationCenter } from '../src/services/notificationService.js';
import { describeNotification } from '../../shared/notifications.js';

test('every subscribed channel sees the event, in registration order', async () => {
  const center = new NotificationCenter(); const seen = [];
  center.subscribe(function store(e) { e.stored = { id: 'row-1' }; seen.push('store'); });
  center.subscribe(function push(e) { seen.push(`push:${e.stored.id}`); });
  await center.publish({ to: 'u1', type: 'follow' });
  assert.deepEqual(seen, ['store', 'push:row-1']);
});

test('a failing channel is contained so the triggering action still succeeds', async () => {
  const center = new NotificationCenter(); const seen = [];
  center.subscribe(function broken() { throw new Error('smtp is down'); });
  center.subscribe(function healthy() { seen.push('healthy'); });
  await assert.doesNotReject(() => center.publish({ to: 'u1', type: 'follow' }));
  assert.deepEqual(seen, ['healthy']);
});

test('unsubscribing detaches a channel', async () => {
  const center = new NotificationCenter(); let calls = 0;
  const off = center.subscribe(() => { calls += 1; });
  await center.publish({ to: 'u1', type: 'follow' });
  off();
  await center.publish({ to: 'u1', type: 'follow' });
  assert.equal(calls, 1);
  assert.equal(center.channelCount, 0);
});

test('each notification type reads as a sentence with somewhere to go', () => {
  const actor = { id: 'u2', name: 'Maya Chen', username: 'maya' };
  assert.match(describeNotification({ type: 'follow', actor }).title, /Maya Chen followed you/);
  assert.equal(describeNotification({ type: 'connect.request', actor }).href, '/friends');
  assert.match(describeNotification({ type: 'premium.requested', actor, data: { plan: 'yearly' } }).title, /Yearly/);
  // A grant with no end date, such as a plan we no longer sell, still reads sensibly.
  assert.match(describeNotification({ type: 'premium.approved', data: { plan: 'legacy' } }).body, /never expires/);
  assert.match(describeNotification({ type: 'premium.approved', data: { plan: 'halfyearly', expiresAt: '2027-01-01' } }).body, /Renews or ends/);
  assert.equal(describeNotification({ type: 'premium.declined', data: {} }).href, '/premium');
});
