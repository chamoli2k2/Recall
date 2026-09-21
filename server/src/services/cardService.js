import { Card, Media, Progress, Revision } from '../models/index.js';
import { accessFolder, mutateFolder, recordEvent } from './accessService.js';
import { assert } from '../utils/errors.js';
import { previewSchedule } from './studyService.js';
import { currentRetrievability, DEFAULT_RETENTION } from './fsrs.js';
import { MAX_CARDS } from './importService.js';
export async function listCards(folderId, user) {
  await accessFolder(folderId, user);
  const cards = await Card.find({ folder: folderId }).sort({ createdAt: 1 });
  const progress = user ? await Progress.find({ user: user.id, card: { $in: cards.map(c => c.id) } }) : [];
  const now = new Date(), retention = user?.desiredRetention || DEFAULT_RETENTION;
  // Each card carries the caller's memory state, current recall probability and the interval every rating would produce.
  const present = p => ({ ...p.toJSON(), retrievability: currentRetrievability(p, now), preview: previewSchedule(p.toObject(), retention, now) });
  const map = new Map(progress.map(p => [String(p.card), present(p)]));
  const fresh = user ? { version: 0, repetitions: 0, interval: 0, bookmarked: false, dueAt: null, state: 'new', retrievability: null, preview: previewSchedule({}, retention, now) } : { version: 0, repetitions: 0, interval: 0, bookmarked: false, dueAt: null, state: 'new' };
  return cards.map(c => ({ ...c.toJSON(), progress: map.get(c.id) ?? fresh }));
}
async function verifyImages(body, folder, session) {
  for (const side of ['front', 'back']) if (body[side]?.image) assert(await Media.exists({ _id: body[side].image, folder: folder.id }).session(session), 400, 'Image does not belong to this folder.');
}
export async function createCard(folderId, user, body) {
  return mutateFolder(folderId, user, 'editor', async (folder, session) => {
    assert(!folder.archived, 409, 'Restore this folder before adding cards.'); await verifyImages(body, folder, session);
    const [card] = await Card.create([{ ...body, folder: folder.id, createdBy: user.id, updatedBy: user.id }], { session });
    await recordEvent(folder, user, 'card.created', body.front.text.slice(0, 100) || 'Image card', session, card.id); return card;
  });
}
/** Bulk insert already-parsed cards in one transaction; one activity event summarises the import. */
export async function importCards(folderId, user, cards, { extraTags = [] } = {}) {
  assert(cards.length, 400, 'No cards were found in that file.'); assert(cards.length <= MAX_CARDS, 400, `Import at most ${MAX_CARDS} cards at a time.`);
  return mutateFolder(folderId, user, 'editor', async (folder, session) => {
    assert(!folder.archived, 409, 'Restore this folder before adding cards.');
    const docs = cards.map(c => ({ ...c, tags: [...new Set([...c.tags, ...extraTags])].slice(0, 10), folder: folder.id, createdBy: user.id, updatedBy: user.id }));
    const created = await Card.insertMany(docs, { session });
    await recordEvent(folder, user, 'cards.imported', `${created.length} cards imported`, session, folder.id, { count: created.length }); return created;
  });
}
export async function exportCards(folderId, user) {
  const folder = await accessFolder(folderId, user); const cards = await Card.find({ folder: folder.id }).sort({ createdAt: 1 });
  return { folder, cards: cards.map(c => ({ front: { text: c.front.text }, back: { text: c.back.text }, tags: c.tags, hint: c.hint, source: c.source })) };
}
export async function updateCard(id, user, body) {
  const current = await Card.findById(id); assert(current, 404, 'Card not found.');
  return mutateFolder(current.folder, user, 'editor', async (folder, session) => {
    const card = await Card.findById(id).session(session); assert(card, 404, 'Card not found.');
    assert(card.version === body.version, 409, 'Someone edited this card. Your draft is kept; close and reopen the card to review their changes.', 'VERSION_CONFLICT');
    await verifyImages(body, folder, session);
    await Revision.create([{ card: card.id, folder: folder.id, editor: user.id, version: card.version, snapshot: { front: card.front, back: card.back, tags: card.tags, hint: card.hint, source: card.source } }], { session });
    const { version, ...data } = body; Object.assign(card, data); card.version++; card.updatedBy = user.id; await card.save({ session });
    await recordEvent(folder, user, 'card.updated', card.front.text.slice(0, 100) || 'Image card', session, card.id, { version: card.version }); return card;
  });
}
export async function deleteCard(id, user) {
  const current = await Card.findById(id); assert(current, 404, 'Card not found.');
  return mutateFolder(current.folder, user, 'editor', async (folder, session) => {
    await Card.deleteOne({ _id: id }, { session }); await Revision.deleteMany({ card: id }, { session }); await Progress.deleteMany({ card: id }, { session });
    await recordEvent(folder, user, 'card.deleted', current.front.text.slice(0, 100), session, id);
  });
}
