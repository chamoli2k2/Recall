export const ACCOUNTS = ['normal', 'premium', 'admin', 'superadmin'];
export const hasPremium = user => ['premium', 'admin', 'superadmin'].includes(user?.account || 'normal');
export const hasDashboard = user => ['admin', 'superadmin'].includes(user?.account || 'normal');
export const isSuperadmin = user => (user?.account || 'normal') === 'superadmin';

/** Admin may set normal/premium. Superadmin may set any role. Nobody may change their own role here. */
export function canAssign(actor, target, next) {
  if (!ACCOUNTS.includes(next)) return false;
  if (!actor || !target) return false;
  if (String(actor.id || actor._id) === String(target.id || target._id)) return false;
  if (isSuperadmin(actor)) return true;
  if (actor.account !== 'admin') return false;
  if (['admin', 'superadmin'].includes(target.account || 'normal')) return false;
  return next === 'normal' || next === 'premium';
}

export const PREMIUM_FEATURES = [
  { id: 'projects', label: 'Projects', detail: 'Group folders into projects you can reopen later.' },
  { id: 'quiz', label: 'Host live quizzes', detail: 'Start a multiplayer room from any folder. Anyone can still join with a code.' },
  { id: 'import', label: 'Import cards', detail: 'Bring in Anki, CSV, Markdown, or JSON decks.' },
  { id: 'export', label: 'Export cards', detail: 'Download a folder as JSON or CSV.' },
  { id: 'thumbnail', label: 'Folder covers', detail: 'Upload a thumbnail for a collection.' },
  { id: 'editors', label: 'Invite editors', detail: 'Give someone write access so you can co-edit in real time. Viewers stay free.' },
];
