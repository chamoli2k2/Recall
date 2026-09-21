import sharp from 'sharp';
import { Card, Media, Revision, Progress } from '../models/index.js';
import * as cards from '../services/cardService.js';
import { accessFolder, mutateFolder } from '../services/accessService.js';
import { assert } from '../utils/errors.js';
export const list = async (req, res) => res.json({ cards: await cards.listCards(req.params.id, req.user) });
export const create = async (req, res) => res.status(201).json({ card: await cards.createCard(req.params.id, req.user, req.body) });
export const update = async (req, res) => res.json({ card: await cards.updateCard(req.params.id, req.user, req.body) });
export const remove = async (req, res) => { await cards.deleteCard(req.params.id, req.user); res.json({ ok: true }); };
export const revisions = async (req, res) => { const card = await Card.findById(req.params.id); assert(card, 404, 'Card not found.'); await accessFolder(card.folder, req.user, 'editor'); res.json({ revisions: await Revision.find({ card: card.id }).sort({ version: -1 }).limit(20).populate('editor', 'name username') }); };
export const bookmark = async (req, res) => { const card = await Card.findById(req.params.id); assert(card, 404, 'Card not found.'); await mutateFolder(card.folder, req.user, 'viewer', async (_folder, session) => { await Progress.updateOne({ user: req.user.id, card: card.id }, { $set: { bookmarked: req.body.bookmarked } }, { upsert: true, session }); }); res.json({ ok: true }); };
export const upload = async (req, res) => {
  assert(req.file, 400, 'Choose an image.');
  // Decode and re-encode instead of trusting extensions or MIME headers; strips metadata.
  let data; try { data = await sharp(req.file.buffer, { limitInputPixels: 25000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); } catch { assert(false, 400, 'Upload a valid JPG, PNG, or WebP image.'); }
  assert(data.length <= 3 * 1024 * 1024, 400, 'Image is too large after processing.');
  const media = await mutateFolder(req.params.id, req.user, 'editor', async (folder, session) => { const [m] = await Media.create([{ folder: folder.id, uploadedBy: req.user.id, data, name: req.file.originalname.slice(0, 150) }], { session }); return m; });
  res.status(201).json({ id: media.id, url: `/api/media/${media.id}` });
};
export const image = async (req, res) => { const media = await Media.findById(req.params.id).select('+data'); assert(media, 404, 'Image not found.'); await accessFolder(media.folder, req.user); res.set({ 'Content-Type': media.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(media.data); };
