import { PremiumOrder, User } from '../models/index.js';
import { hasPremium, hasDashboard, planById, premiumDaysLeft, premiumExpiryAfter } from '../../../shared/account.js';
import { notify, notifyStaff } from './notificationService.js';
import { availableMethods, requireMethod, razorpay } from './payments/index.js';
import { logger } from '../utils/logger.js';
import { assert, badRequest, notFound } from '../utils/errors.js';

const presentOrder = order => ({
  id: order.id, plan: order.plan, method: order.method, status: order.status,
  amount: order.amount, currency: order.currency, createdAt: order.createdAt,
  hasProof: !!order.proofType && order.method === 'manual',
});

export const mySubscription = user => ({
  account: user.account || 'normal',
  plan: user.premiumPlan || '',
  planLabel: planById(user.premiumPlan)?.label || '',
  expiresAt: user.premiumExpiresAt || null,
  daysLeft: premiumDaysLeft(user),
  active: hasPremium(user),
});

/**
 * The single place a paid plan is applied, whichever way it was paid for. The status change is a
 * conditional update, so a gateway webhook and the browser callback racing each other — or the same
 * webhook delivered twice — can only ever grant the plan once.
 */
export async function fulfilOrder(orderId, status, { actor = null, paymentId = null } = {}) {
  const update = { status, ...(actor ? { reviewedBy: actor.id } : {}), ...(paymentId ? { gatewayPaymentId: paymentId } : {}) };
  const order = await PremiumOrder.findOneAndUpdate({ _id: orderId, status: 'pending' }, { $set: update }, { new: true });
  if (!order) return { order: null, alreadySettled: true };

  let expiresAt = null;
  if (status === 'approved') {
    const user = await User.findById(order.user);
    if (user) {
      expiresAt = premiumExpiryAfter(user, planById(order.plan));
      if ((user.account || 'normal') === 'normal') user.account = 'premium';
      user.premiumPlan = order.plan;
      user.premiumExpiresAt = expiresAt;
      await user.save();
    }
  }
  await notify(order.user, status === 'approved' ? 'premium.approved' : 'premium.declined', { actor, data: { plan: order.plan, expiresAt } });
  logger.info(`premium order ${status}`, { orderId: order.id, plan: order.plan, method: order.method });
  return { order, alreadySettled: false };
}

const openOrderFor = user => PremiumOrder.findOne({ user: user.id, status: 'pending' });

async function newOrder(user, body, method, { proof = null } = {}) {
  assert(!hasPremium(user), 400, 'You already have Premium.', 'ALREADY_PREMIUM');
  const plan = planById(body.plan);
  assert(plan, 400, 'Choose a Premium plan.', 'UNKNOWN_PLAN');
  const open = await openOrderFor(user);
  assert(!open, 400, 'You already have a payment in progress. Finish or cancel it first.', 'ORDER_IN_PROGRESS');
  return PremiumOrder.create({
    user: user.id, plan: plan.id, method, amount: plan.price * 100, currency: 'INR',
    name: body.name, email: body.email, phone: body.phone, country: body.country, address: body.address,
    ...(proof ? { proof, proofType: 'image/webp' } : {}),
    status: 'pending',
  });
}

/** Manual flow: the buyer proves they paid, an admin confirms it later. */
export async function submitOrder(user, body, proof) {
  requireMethod('manual');
  assert(proof?.length, 400, 'Upload a screenshot of the payment.', 'PROOF_REQUIRED');
  const order = await newOrder(user, body, 'manual', { proof });
  await notifyStaff('premium.requested', { actor: user, data: { orderId: order.id, plan: order.plan } });
  return presentOrder(order);
}

/** Gateway flow, step one: reserve an order with Razorpay and hand the client what checkout needs. */
export async function startCheckout(user, body) {
  requireMethod('razorpay');
  const order = await newOrder(user, body, 'razorpay');
  try {
    const gateway = await razorpay.createOrder({ amount: order.amount, currency: order.currency, receipt: order.id, notes: { plan: order.plan, username: user.username } });
    order.gatewayOrderId = gateway.id;
    await order.save();
    return { order: presentOrder(order), checkout: { key: razorpay.keyId(), orderId: gateway.id, amount: gateway.amount, currency: gateway.currency, name: 'Recall', description: `${planById(order.plan).label} plan`, prefill: { name: order.name, email: order.email, contact: order.phone } } };
  } catch (e) {
    // Never strand a pending order the buyer cannot retry past.
    await PremiumOrder.deleteOne({ _id: order.id, status: 'pending' });
    throw e;
  }
}

/** Gateway flow, step two: the browser came back. Verify the signature before believing any of it. */
export async function confirmCheckout(user, { orderId, paymentId, signature }) {
  const order = await PremiumOrder.findOne({ gatewayOrderId: orderId, user: user.id });
  if (!order) throw notFound('That payment does not match an order.', 'NO_ORDER');
  if (!razorpay.checkoutSignatureValid({ orderId, paymentId, signature })) {
    logger.warn('rejected a razorpay callback with a bad signature', { orderId, userId: user.id });
    throw badRequest('We could not verify that payment. Nothing has been charged twice — contact us if money left your account.', 'BAD_SIGNATURE');
  }
  if (order.status === 'approved') return { order: presentOrder(order), subscription: mySubscription(await User.findById(user.id)) };
  await fulfilOrder(order.id, 'approved', { paymentId });
  return { order: presentOrder(await PremiumOrder.findById(order.id)), subscription: mySubscription(await User.findById(user.id)) };
}

/**
 * The authoritative path. If the buyer closes the tab after paying, the browser callback never
 * arrives but this still does, so the plan is granted either way.
 */
export async function handleWebhook(rawBody, signature) {
  if (!razorpay.webhookSignatureValid(rawBody, signature)) {
    logger.warn('rejected a razorpay webhook with a bad signature');
    throw badRequest('Invalid webhook signature.', 'BAD_SIGNATURE');
  }
  const { event, orderId, paymentId, status } = razorpay.readWebhook(rawBody);
  if (!orderId) return { ignored: event || 'unknown' };
  const order = await PremiumOrder.findOne({ gatewayOrderId: orderId });
  if (!order) return { ignored: 'unknown-order' };
  if (event === 'payment.captured' || status === 'captured') {
    const { alreadySettled } = await fulfilOrder(order.id, 'approved', { paymentId });
    return { handled: 'approved', alreadySettled };
  }
  if (event === 'payment.failed') {
    await fulfilOrder(order.id, 'declined', { paymentId });
    return { handled: 'declined' };
  }
  return { ignored: event };
}

export async function cancelOrder(user) {
  const order = await openOrderFor(user);
  if (!order) return { cancelled: false };
  await PremiumOrder.deleteOne({ _id: order.id, status: 'pending' });
  return { cancelled: true };
}

export async function myOrder(user) {
  const order = await PremiumOrder.findOne({ user: user.id }).sort({ createdAt: -1 });
  return { order: order ? presentOrder(order) : null, subscription: mySubscription(user), methods: availableMethods() };
}

export async function proofFor(viewer, orderId) {
  const order = await PremiumOrder.findById(orderId).select('+proof');
  assert(order, 404, 'Request not found.');
  const owner = String(order.user) === String(viewer.id);
  assert(owner || hasDashboard(viewer), 404, 'Request not found.');
  assert(order.proof, 404, 'No payment photo on this request.');
  return { data: order.proof, type: order.proofType || 'image/webp' };
}
