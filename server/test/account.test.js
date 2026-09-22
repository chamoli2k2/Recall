import test from 'node:test';
import assert from 'node:assert/strict';
import { canAssign, hasPremium, hasDashboard } from '../../shared/account.js';
test('premium and dashboard flags follow account type', () => {
  assert.equal(hasPremium({ account: 'normal' }), false);
  assert.equal(hasPremium({ account: 'premium' }), true);
  assert.equal(hasPremium({ account: 'admin' }), true);
  assert.equal(hasDashboard({ account: 'premium' }), false);
  assert.equal(hasDashboard({ account: 'admin' }), true);
  assert.equal(hasDashboard({ account: 'superadmin' }), true);
});
test('admins can only move normal people between normal and premium', () => {
  const admin = { id: '1', account: 'admin' };
  const learner = { id: '2', account: 'normal' };
  assert.equal(canAssign(admin, learner, 'premium'), true);
  assert.equal(canAssign(admin, learner, 'admin'), false);
  assert.equal(canAssign(admin, { id: '3', account: 'superadmin' }, 'normal'), false);
  assert.equal(canAssign(admin, admin, 'premium'), false);
});
test('superadmin can assign any role except their own', () => {
  const superadmin = { id: '1', account: 'superadmin' };
  assert.equal(canAssign(superadmin, { id: '2', account: 'admin' }, 'normal'), true);
  assert.equal(canAssign(superadmin, { id: '2', account: 'normal' }, 'superadmin'), true);
  assert.equal(canAssign(superadmin, superadmin, 'admin'), false);
});
