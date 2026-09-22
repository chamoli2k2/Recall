import { PremiumOrder } from '../models/index.js';
import { hasPremium, hasDashboard, planById, premiumDaysLeft } from '../../../shared/account.js';
import { notifyStaff } from './notificationService.js';
import { assert } from '../utils/errors.js';

const presentOrder = order => ({ id: order.id, plan: order.plan, status: order.status, createdAt: order.createdAt, hasProof: true });

/** What the signed-in user sees about their own subscription. */
export const mySubscription = user => ({
  account: user.account || 'normal',
  plan: user.premiumPlan || '',
  planLabel: planById(user.premiumPlan)?.label || '',
  expiresAt: user.premiumExpiresAt || null,
  daysLeft: premiumDaysLeft(user),
  active: hasPremium(user),
});

export async function submitOrder(user, body, proof) {
  assert(!hasPremium(user), 400, 'You already have Premium.');
  assert(planById(body.plan), 400, 'Choose a Premium plan.');
  assert(proof?.length, 400, 'Upload a screenshot of the payment.');
  const open = await PremiumOrder.findOne({ user: user.id, status: 'pending' });
  assert(!open, 400, 'You already have a pending request. We will confirm after payment.');
  const order = await PremiumOrder.create({
    user: user.id,
    plan: body.plan,
    name: body.name,
    email: body.email,
    phone: body.phone,
    country: body.country,
    address: body.address,
    proof,
    proofType: 'image/webp',
    status: 'pending',
  });
  await notifyStaff('premium.requested', { actor: user, data: { orderId: order.id, plan: order.plan } });
  return presentOrder(order);
}

export async function myOrder(user) {
  const order = await PremiumOrder.findOne({ user: user.id }).sort({ createdAt: -1 });
  return { order: order ? presentOrder(order) : null, subscription: mySubscription(user) };
}

export async function proofFor(viewer, orderId) {
  const order = await PremiumOrder.findById(orderId).select('+proof');
  assert(order, 404, 'Request not found.');
  const owner = String(order.user) === String(viewer.id);
  assert(owner || hasDashboard(viewer), 404, 'Request not found.');
  assert(order.proof, 404, 'No payment photo on this request.');
  return { data: order.proof, type: order.proofType || 'image/webp' };
}
