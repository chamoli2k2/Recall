import { Card, Progress, Review } from '../models/index.js';
import { mutateFolder } from './accessService.js';
import { assert } from '../utils/errors.js';
export function schedule(previous, rating, now = new Date()) {
  let { interval = 0, repetitions = 0, ease = 2.5 } = previous;
  if (rating === 'again') { repetitions = 0; interval = 0; ease = Math.max(1.3, ease - .2); }
  else { interval = rating === 'hard' ? Math.max(1, Math.round(interval * 1.2)) : rating === 'easy' ? Math.max(4, Math.round(interval * ease * 1.3)) : repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, Math.round(interval * ease)); repetitions++; if (rating === 'easy') ease += .15; if (rating === 'hard') ease = Math.max(1.3, ease - .15); }
  return { interval, repetitions, ease, lastReviewedAt: now, dueAt: new Date(now.getTime() + (rating === 'again' ? 600000 : interval * 86400000)) };
}
export async function reviewCard(user, body) {
  const card = await Card.findById(body.cardId); assert(card, 404, 'Card not found.');
  return mutateFolder(card.folder, user, 'viewer', async (_folder, session) => {
    const prior = await Review.findOne({ user: user.id, requestId: body.requestId }).session(session);
    if (prior) { assert(String(prior.card) === body.cardId && prior.rating === body.rating, 409, 'Review key already used for a different review.'); return prior.result; }
    let progress = await Progress.findOne({ user: user.id, card: card.id }).session(session);
    assert((progress?.version ?? 0) === body.version, 409, 'This card was reviewed on another device. Refresh the session.', 'VERSION_CONFLICT');
    if (!progress) progress = new Progress({ user: user.id, card: card.id });
    Object.assign(progress, schedule(progress, body.rating)); progress.version++;
    await progress.save({ session }); const result = progress.toJSON();
    await Review.create([{ user: user.id, card: card.id, requestId: body.requestId, rating: body.rating, result }], { session }); return result;
  });
}
