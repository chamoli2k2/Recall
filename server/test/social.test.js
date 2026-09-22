import test from 'node:test';
import assert from 'node:assert/strict';
import { flagsFromRows } from '../src/services/socialService.js';
test('relation flags: follow is one-way; friend is a single connect row', () => {
  const a = 'aaaaaaaaaaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  assert.deepEqual(flagsFromRows(a, b, []), { following: false, friendship: 'none' });
  assert.deepEqual(flagsFromRows(a, b, [{ from: a, to: b, kind: 'follow', status: 'active' }]), { following: true, friendship: 'none' });
  assert.deepEqual(flagsFromRows(a, b, [{ from: a, to: b, kind: 'connect', status: 'pending' }]), { following: false, friendship: 'outgoing' });
  assert.deepEqual(flagsFromRows(a, b, [{ from: b, to: a, kind: 'connect', status: 'pending' }]), { following: false, friendship: 'incoming' });
  assert.deepEqual(flagsFromRows(a, b, [{ from: a, to: b, kind: 'connect', status: 'active' }]), { following: false, friendship: 'friends' });
  assert.deepEqual(flagsFromRows(a, b, [{ from: b, to: a, kind: 'connect', status: 'active' }, { from: a, to: b, kind: 'follow', status: 'active' }]), { following: true, friendship: 'friends' });
});
