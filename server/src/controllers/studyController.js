import { Folder, Review, Progress, Card } from '../models/index.js';
import { reviewCard } from '../services/studyService.js';
export const review = async (req, res) => res.json({ progress: await reviewCard(req.user, req.body) });
export const stats = async (req, res) => {
  const accessible = await Folder.find({ archived: false, $or: [{ owner: req.user.id }, { 'members.user': req.user.id }, { _id: { $in: req.user.savedFolders }, visibility: 'global' }] }).select('_id');
  const cards = await Card.find({ folder: { $in: accessible.map(f => f.id) } }).select('_id');
  const ids = cards.map(c => c._id), progress = await Progress.find({ user: req.user.id, card: { $in: ids } });
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const reviewsToday = await Review.countDocuments({ user: req.user.id, createdAt: { $gte: start } });
  const future = progress.filter(p => p.dueAt > new Date()).length;
  res.json({ stats: { totalCards: cards.length, due: cards.length - future, reviewed: await Review.countDocuments({ user: req.user.id }), reviewsToday, mastered: progress.filter(p => p.interval >= 21).length, goal: req.user.dailyGoal } });
};
