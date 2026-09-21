import { Folder, Card, Progress, Review } from '../models/index.js';
import { currentRetrievability, DEFAULT_RETENTION } from './fsrs.js';
const DAY = 86400000;
const startOfUtcDay = d => { const s = new Date(d); s.setUTCHours(0, 0, 0, 0); return s; };
/** Folders the user can study: own, shared with them, or saved public collections. */
export async function accessibleFolderIds(user) {
  const folders = await Folder.find({ archived: false, $or: [{ owner: user.id }, { 'members.user': user.id }, { _id: { $in: user.savedFolders || [] }, visibility: 'global' }] }).select('_id');
  return folders.map(f => f._id);
}
/**
 * Study statistics with FSRS retention analytics: predicted recall right now, observed recall over the last 30 days,
 * a 14-day due forecast, memory-state distribution and the hardest cards. Everything is scoped to the caller.
 */
export async function studyStats(user, now = new Date()) {
  const folderIds = await accessibleFolderIds(user);
  const cards = await Card.find({ folder: { $in: folderIds } }).select('_id front.text folder');
  const cardIds = cards.map(c => c._id);
  const [progress, reviewed, reviewsToday, recent] = await Promise.all([
    Progress.find({ user: user.id, card: { $in: cardIds } }),
    Review.countDocuments({ user: user.id }),
    Review.countDocuments({ user: user.id, createdAt: { $gte: startOfUtcDay(now) } }),
    Review.find({ user: user.id, createdAt: { $gte: new Date(now - 30 * DAY) } }).select('rating result createdAt')
  ]);
  const due = cards.length - progress.filter(p => p.dueAt > now).length;
  // Predicted retention: mean recall probability across every card with memory state.
  const probabilities = progress.map(p => currentRetrievability(p, now)).filter(r => r != null);
  const predictedRetention = probabilities.length ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length : null;
  // Observed retention: share of non-first reviews that were not "again". Matches how FSRS is evaluated.
  const graded = recent.filter(r => (r.result?.reps ?? r.result?.repetitions ?? 0) > 1 || r.result?.lapses > 0 || r.rating !== 'again' && (r.result?.state === 'review'));
  const observedRetention = graded.length ? graded.filter(r => r.rating !== 'again').length / graded.length : null;
  // Due forecast: how many cards come due on each of the next 14 UTC days (day 0 includes overdue).
  const today = startOfUtcDay(now); const forecast = Array.from({ length: 14 }, (_, i) => ({ date: new Date(today.getTime() + i * DAY).toISOString().slice(0, 10), due: 0 }));
  for (const p of progress) { const i = Math.max(0, Math.floor((startOfUtcDay(p.dueAt) - today) / DAY)); if (i < 14) forecast[i].due++; }
  forecast[0].due += cards.length - progress.length; // never-studied cards are available today
  const states = { new: cards.length - progress.length, learning: 0, review: 0, relearning: 0 };
  for (const p of progress) states[p.state === 'new' && p.reps ? 'learning' : (p.state in states ? p.state : 'review')]++;
  const byCard = new Map(cards.map(c => [String(c._id), c]));
  const hardest = progress.filter(p => p.difficulty > 0).sort((a, b) => b.difficulty - a.difficulty || b.lapses - a.lapses).slice(0, 5)
    .map(p => ({ cardId: String(p.card), folderId: String(byCard.get(String(p.card))?.folder), text: (byCard.get(String(p.card))?.front.text || 'Image card').slice(0, 90), difficulty: Math.round(p.difficulty * 10) / 10, lapses: p.lapses, stability: Math.round(p.stability * 10) / 10 }));
  const avgStability = progress.length ? progress.reduce((a, p) => a + (p.stability || p.interval || 0), 0) / progress.length : 0;
  return {
    totalCards: cards.length, due, reviewed, reviewsToday, mastered: progress.filter(p => (p.stability || p.interval) >= 21).length, goal: user.dailyGoal,
    retention: { desired: user.desiredRetention || DEFAULT_RETENTION, predicted: predictedRetention, observed: observedRetention, sampled: graded.length, averageStability: Math.round(avgStability * 10) / 10 },
    forecast, states, hardest
  };
}
