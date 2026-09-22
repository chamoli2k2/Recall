import sharp from 'sharp';
import * as premium from '../services/premiumService.js';
import { premiumOrderSchema } from '../middleware/validate.js';
import { assert } from '../utils/errors.js';

export const submit = async (req, res) => {
  assert(req.file, 400, 'Upload a screenshot of the payment.');
  const body = premiumOrderSchema.parse(req.body);
  let data;
  try { data = await sharp(req.file.buffer, { limitInputPixels: 25000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); }
  catch { assert(false, 400, 'Upload a valid JPG, PNG, or WebP screenshot.'); }
  assert(data.length <= 3 * 1024 * 1024, 400, 'Payment photo is too large after processing.');
  res.status(201).json({ order: await premium.submitOrder(req.user, body, data) });
};
export const mine = async (req, res) => res.json({ order: await premium.myOrder(req.user) });
export const proof = async (req, res) => {
  const { data, type } = await premium.proofFor(req.user, req.params.id);
  res.set({ 'Content-Type': type, 'Cache-Control': 'private, no-store' }).send(data);
};
