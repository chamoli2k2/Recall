import { User, PremiumOrder } from '../models/index.js';
import { canAssign, ACCOUNTS, planById, premiumDaysLeft, hasPremium } from '../../../shared/account.js';
import { fulfilOrder } from './premiumService.js';
import { assert } from '../utils/errors.js';

const publicAdmin = u => ({
  id: u.id, username: u.username, name: u.name, email: u.email,
  account: u.account || 'normal', createdAt: u.createdAt,
  plan: u.premiumPlan || '', planLabel: planById(u.premiumPlan)?.label || '',
  expiresAt: u.premiumExpiresAt || null, daysLeft: premiumDaysLeft(u), premiumActive: hasPremium(u),
});

export async function listUsers(q) {
  const filter = {};
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ username: rx }, { name: rx }, { email: rx }];
  }
  const users = await User.find(filter).select('+email name username account premiumPlan premiumExpiresAt createdAt').sort({ createdAt: -1 }).limit(100);
  return users.map(publicAdmin);
}

export async function setAccount(actor, userId, account) {
  assert(ACCOUNTS.includes(account), 400, 'Unknown account type.');
  const target = await User.findById(userId).select('+email');
  assert(target, 404, 'User not found.');
  assert(canAssign(actor, target, account), 403, 'You cannot change that account.');
  if (target.account === 'superadmin' && account !== 'superadmin') {
    const left = await User.countDocuments({ account: 'superadmin', _id: { $ne: target.id } });
    assert(left >= 1, 400, 'Keep at least one Superadmin.');
  }
  // A role granted by hand carries no end date; moving someone off Premium clears the subscription.
  target.account = account;
  if (account !== 'premium') { target.premiumPlan = ''; target.premiumExpiresAt = null; }
  await target.save();
  return publicAdmin(target);
}

export async function listOrders(status) {
  const filter = status ? { status } : {};
  const rows = await PremiumOrder.find(filter).sort({ createdAt: -1 }).limit(80).populate('user', 'name username account');
  // Only a manual order has a screenshot to review; a gateway order carries its payment id instead.
  return rows.map(o => ({ ...o.toJSON(), hasProof: o.method === 'manual', proofUrl: o.method === 'manual' ? `/api/premium/orders/${o.id}/proof` : null }));
}

/** Approving by hand and a verified gateway payment converge on the same fulfilment. */
export async function decideOrder(actor, orderId, status) {
  assert(['approved', 'declined'].includes(status), 400, 'Use approved or declined.');
  const { order, alreadySettled } = await fulfilOrder(orderId, status, { actor });
  assert(!alreadySettled, 404, 'No pending order.');
  return order;
}
