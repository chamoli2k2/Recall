import { PremiumOrder } from '../models/index.js';
import { hasPremium, hasDashboard } from '../../../shared/account.js';
import { assert } from '../utils/errors.js';

export async function submitOrder(user, body, proof) {
  assert(!hasPremium(user), 400, 'You already have Premium.');
  assert(proof?.length, 400, 'Upload a screenshot of the payment.');
  const open = await PremiumOrder.findOne({ user: user.id, status: 'pending' });
  assert(!open, 400, 'You already have a pending request. We will confirm after payment.');
  const order = await PremiumOrder.create({
    user: user.id,
    name: body.name,
    email: body.email,
    phone: body.phone,
    country: body.country,
    address: body.address,
    proof,
    proofType: 'image/webp',
    status: 'pending',
  });
  return { id: order.id, status: order.status, hasProof: true };
}

export async function myOrder(user) {
  const order = await PremiumOrder.findOne({ user: user.id }).sort({ createdAt: -1 });
  if (!order) return null;
  return { id: order.id, status: order.status, createdAt: order.createdAt, hasProof: true };
}

export async function proofFor(viewer, orderId) {
  const order = await PremiumOrder.findById(orderId).select('+proof');
  assert(order, 404, 'Request not found.');
  const owner = String(order.user) === String(viewer.id);
  assert(owner || hasDashboard(viewer), 404, 'Request not found.');
  assert(order.proof, 404, 'No payment photo on this request.');
  return { data: order.proof, type: order.proofType || 'image/webp' };
}
