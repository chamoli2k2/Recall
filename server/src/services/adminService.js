import { User, PremiumOrder } from '../models/index.js';
import { canAssign, ACCOUNTS } from '../../../shared/account.js';
import { assert } from '../utils/errors.js';

const publicAdmin = u => ({ id: u.id, username: u.username, name: u.name, email: u.email, account: u.account || 'normal', createdAt: u.createdAt });

export async function listUsers(q) {
  const filter = {};
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ username: rx }, { name: rx }, { email: rx }];
  }
  const users = await User.find(filter).select('+email name username account createdAt').sort({ createdAt: -1 }).limit(100);
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
  target.account = account;
  await target.save();
  return publicAdmin(target);
}

export async function listOrders(status) {
  const filter = status ? { status } : {};
  const rows = await PremiumOrder.find(filter).sort({ createdAt: -1 }).limit(80).populate('user', 'name username account');
  return rows.map(o => ({ ...o.toJSON(), hasProof: true, proofUrl: `/api/premium/orders/${o.id}/proof` }));
}

export async function decideOrder(actor, orderId, status) {
  assert(['approved', 'declined'].includes(status), 400, 'Use approved or declined.');
  const order = await PremiumOrder.findById(orderId);
  assert(order && order.status === 'pending', 404, 'No pending order.');
  order.status = status;
  order.reviewedBy = actor.id;
  await order.save();
  if (status === 'approved') {
    const user = await User.findById(order.user);
    if (user && (user.account || 'normal') === 'normal') { user.account = 'premium'; await user.save(); }
  }
  return order;
}
