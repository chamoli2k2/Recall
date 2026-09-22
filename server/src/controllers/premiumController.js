import sharp from 'sharp';
import * as premium from '../services/premiumService.js';
import { premiumOrderSchema } from '../middleware/validate.js';
import { assert } from '../utils/errors.js';

export async function toWebp(file) {
  assert(file, 400, 'Upload a screenshot of the payment.', 'PROOF_REQUIRED');
  let data;
  try { data = await sharp(file.buffer, { limitInputPixels: 25000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); }
  catch { assert(false, 400, 'Upload a valid JPG, PNG, or WebP screenshot.', 'BAD_IMAGE'); }
  assert(data.length <= 3 * 1024 * 1024, 400, 'Payment photo is too large after processing.', 'FILE_TOO_LARGE');
  return data;
}

export const submit = async (req, res) => {
  const body = premiumOrderSchema.parse(req.body);
  res.status(201).json({ order: await premium.submitOrder(req.user, body, await toWebp(req.file)) });
};
export const start = async (req, res) => res.status(201).json(await premium.startCheckout(req.user, req.body));
export const confirm = async (req, res) => res.json(await premium.confirmCheckout(req.user, req.body));
export const cancel = async (req, res) => res.json(await premium.cancelOrder(req.user));
export const mine = async (req, res) => res.json(await premium.myOrder(req.user));
export const proof = async (req, res) => {
  const { data, type } = await premium.proofFor(req.user, req.params.id);
  res.set({ 'Content-Type': type, 'Cache-Control': 'private, no-store' }).send(data);
};
/** Mounted on the raw body, before the JSON parser, because the signature covers the exact bytes. */
export const webhook = async (req, res) => {
  const result = await premium.handleWebhook(req.body, req.get('x-razorpay-signature'));
  res.json({ ok: true, ...result });
};
