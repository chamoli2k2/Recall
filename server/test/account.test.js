import test from 'node:test';
import assert from 'node:assert/strict';
import { canAssign, hasPremium, hasDashboard, planById, premiumDaysLeft, premiumExpiryAfter, PREMIUM_PLANS } from '../../shared/account.js';
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
const DAY = 86400000;
test('a lapsed subscription loses Premium but staff roles never do', () => {
  const now = Date.now();
  assert.equal(hasPremium({ account: 'premium', premiumExpiresAt: new Date(now + 5 * DAY) }, now), true);
  assert.equal(hasPremium({ account: 'premium', premiumExpiresAt: new Date(now - DAY) }, now), false);
  assert.equal(hasPremium({ account: 'premium', premiumExpiresAt: null }, now), true, 'no end date means it never lapses');
  assert.equal(hasPremium({ account: 'admin', premiumExpiresAt: new Date(now - DAY) }, now), true);
});
test('days left rounds up and goes negative once lapsed', () => {
  const now = Date.now();
  assert.equal(premiumDaysLeft({ premiumExpiresAt: new Date(now + 2.4 * DAY) }, now), 3);
  assert.equal(premiumDaysLeft({ premiumExpiresAt: new Date(now - 2 * DAY) }, now), -2);
  assert.equal(premiumDaysLeft({ premiumExpiresAt: null }, now), null);
});
test('buying a plan extends an unexpired subscription instead of truncating it', () => {
  const now = Date.now();
  const monthly = planById('monthly');
  assert.equal(premiumExpiryAfter({ premiumExpiresAt: null }, monthly, now).getTime(), now + 30 * DAY);
  assert.equal(premiumExpiryAfter({ premiumExpiresAt: new Date(now + 100 * DAY) }, monthly, now).getTime(), now + 130 * DAY);
  assert.equal(premiumExpiryAfter({ premiumExpiresAt: new Date(now - 10 * DAY) }, monthly, now).getTime(), now + 30 * DAY, 'a lapsed subscription restarts from today');
  // Every plan on sale runs out; only a legacy grant with no day count has no end date.
  for (const plan of PREMIUM_PLANS) assert.ok(plan.days > 0, `${plan.id} should have a term`);
  assert.equal(premiumExpiryAfter({}, { id: 'legacy', days: null }, now), null);
});
