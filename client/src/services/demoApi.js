import { uuid } from './uuid';
import { sampleFolders } from '../../../shared/sampleData';
import { planById } from '../../../shared/account.js';
const user = { id: 'demo-user', username: 'gaurav', name: 'Gaurav Prakash', bio: 'Learning something new, one card at a time.', dailyGoal: 20, savedFolders: [], account: 'superadmin' };
const collaborators = [{ id: 'demo-alex', name: 'Alex Morgan', username: 'alex' }, { id: 'demo-maya', name: 'Maya Chen', username: 'maya' }];
// Stand-in roster so the dashboard has something to manage in the preview.
const inDays = n => new Date(Date.now() + n * 86400000).toISOString();
let staff = [
  { id: user.id, username: user.username, name: user.name, email: 'gaurav@demo.test', account: user.account, plan: '', planLabel: '', expiresAt: null, daysLeft: null },
  { id: 'demo-alex', username: 'alex', name: 'Alex Morgan', email: 'alex@demo.test', account: 'premium', plan: 'yearly', planLabel: 'Yearly', expiresAt: inDays(281), daysLeft: 281 },
  { id: 'demo-maya', username: 'maya', name: 'Maya Chen', email: 'maya@demo.test', account: 'admin', plan: '', planLabel: '', expiresAt: null, daysLeft: null },
  { id: 'demo-ada', username: 'ada', name: 'Ada Lovelace', email: 'ada@demo.test', account: 'premium', plan: 'lifetime', planLabel: 'Lifetime', expiresAt: null, daysLeft: null },
  { id: 'demo-linus', username: 'linus', name: 'Linus Berg', email: 'linus@demo.test', account: 'premium', plan: 'monthly', planLabel: 'Monthly', expiresAt: inDays(4), daysLeft: 4 },
  { id: 'demo-sara', username: 'sara', name: 'Sara Iyer', email: 'sara@demo.test', account: 'premium', plan: 'quarterly', planLabel: 'Quarterly', expiresAt: inDays(-12), daysLeft: -12 },
  { id: 'demo-tom', username: 'tom', name: 'Tom Rivera', email: 'tom@demo.test', account: 'normal', plan: '', planLabel: '', expiresAt: null, daysLeft: null },
];
let demoNotifications = [
  { id: 'n1', type: 'connect.request', actor: { id: 'demo-maya', name: 'Maya Chen', username: 'maya' }, data: {}, createdAt: new Date(Date.now() - 6 * 60000).toISOString(), readAt: null },
  { id: 'n2', type: 'premium.requested', actor: { id: 'demo-sara', name: 'Sara Iyer', username: 'sara' }, data: { plan: 'quarterly' }, createdAt: new Date(Date.now() - 52 * 60000).toISOString(), readAt: null },
  { id: 'n3', type: 'follow', actor: { id: 'demo-alex', name: 'Alex Morgan', username: 'alex' }, data: {}, createdAt: new Date(Date.now() - 20 * 3600000).toISOString(), readAt: new Date().toISOString() },
];
const demoProof = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="#f4f1fb"/><circle cx="150" cy="110" r="38" fill="#2c7a4f"/><path d="M132 110l13 13 24-26" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="150" y="182" font-family="Arial" font-size="19" font-weight="bold" fill="#242331" text-anchor="middle">Payment successful</text><text x="150" y="222" font-family="Arial" font-size="30" font-weight="bold" fill="#242331" text-anchor="middle">Rs 499.00</text><text x="150" y="256" font-family="Arial" font-size="13" fill="#7a7290" text-anchor="middle">To your-upi-id@bank</text><text x="150" y="278" font-family="Arial" font-size="13" fill="#7a7290" text-anchor="middle">UPI Ref 402198337654</text><text x="150" y="380" font-family="Arial" font-size="11" fill="#a09aae" text-anchor="middle">Sample screenshot (preview only)</text></svg>');
// The preview shows both methods so the picker is visible, but neither can actually take money.
const demoMethods = [
  { id: 'razorpay', label: 'Pay online', blurb: 'UPI, card, net banking, or wallet. Premium turns on the moment the payment clears.', instant: true, requiresProof: false },
  { id: 'manual', label: 'Pay by UPI transfer', blurb: 'Send the amount to our UPI ID and upload the screenshot. An admin confirms it, usually within a day.', instant: false, requiresProof: true },
];
let demoOrders = [{ id: 'demo-order-1', plan: 'quarterly', method: 'manual', name: 'Sara Iyer', email: 'sara@demo.test', phone: '+91 98765 43210', country: 'India', address: '221B Baker Street, Mumbai 400001', status: 'pending', hasProof: true, proofUrl: demoProof, user: { username: 'sara' }, createdAt: new Date().toISOString() }];
let folders = sampleFolders.map((f, i) => ({ ...f, cards: undefined, id: `folder-${i}`, owner: i === 4 ? collaborators[1] : user, role: i === 4 ? 'viewer' : 'owner', version: 0, members: i === 0 ? [{ user: collaborators[0], role: 'editor' }] : [], memberCount: i === 0 ? 2 : 1, archived: false, cardCount: f.cards.length, createdAt: new Date().toISOString(), updatedAt: new Date(Date.now() - i * 3600000).toISOString() }));
let cards = sampleFolders.flatMap((f, i) => f.cards.map(([front, back, tags], j) => ({ id: `card-${i}-${j}`, folder: `folder-${i}`, front: { text: front }, back: { text: back }, tags, hint: '', source: '', version: 0, progress: { version: 0, repetitions: 0, interval: 0, bookmarked: false, dueAt: null } })));
let reviews = [], activity = [], revisions = {}, images = {};
const clone = x => structuredClone(x);
const error = message => { throw new Error(message); };
export async function demoRequest(path, options = {}) {
  const method = options.method || 'GET'; const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {};
  const parts = path.split('?')[0].split('/').filter(Boolean); const [entity, id, action] = parts;
  if (path === '/auth/me') return { user: clone(user) };
  if (entity === 'users') {
    if (!id) { const q = new URLSearchParams(path.split('?')[1] || '').get('q') || ''; return { users: [user, ...collaborators].filter(u => u.username.startsWith(q.toLowerCase()) || u.name.toLowerCase().startsWith(q.toLowerCase())).map(u => ({ id: u.id, username: u.username, name: u.name })) }; }
    const profile = [user, ...collaborators].find(u => u.username === id); if (!profile) error('User not found.');
    return { profile: { ...clone(profile), followers: 0, following: 0, friends: 0, relation: { following: false, friendship: profile.id === user.id ? 'self' : 'none' } }, folders: clone(folders.filter(f => f.owner.id === profile.id && f.visibility === 'global' && !f.archived)) };
  }
  if (path === '/me/friends' || path === '/me/requests') return { people: [] };
  if (entity === 'notifications') {
    if (id === 'read') { demoNotifications = demoNotifications.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })); return { unread: 0 }; }
    return { notifications: clone(demoNotifications), unread: demoNotifications.filter(n => !n.readAt).length };
  }
  if (path === '/premium/order') return { order: null, subscription: { account: user.account, plan: '', planLabel: '', expiresAt: null, daysLeft: null, active: true }, methods: clone(demoMethods) };
  if (path.startsWith('/premium/checkout')) error('Paying needs a real account. Sign up outside the preview to buy Premium.');
  if (entity === 'admin') {
    if (id === 'users' && !action) {
      const q = (new URLSearchParams(path.split('?')[1] || '').get('q') || '').toLowerCase();
      return { users: clone(staff.filter(u => !q || `${u.name} ${u.username} ${u.email}`.toLowerCase().includes(q))) };
    }
    if (id === 'users' && method === 'PATCH') {
      const target = staff.find(u => u.id === action); if (!target) error('User not found.');
      target.account = body.account;
      if (body.account !== 'premium') Object.assign(target, { plan: '', planLabel: '', expiresAt: null, daysLeft: null });
      return { user: clone(target) };
    }
    if (id === 'orders' && !action) return { orders: clone(demoOrders) };
    if (id === 'orders' && method === 'PATCH') {
      const order = demoOrders.find(o => o.id === action); if (!order) error('No pending order.');
      order.status = body.status;
      if (body.status === 'approved') {
        const u = staff.find(s => s.username === order.user.username), plan = planById(order.plan);
        if (u) Object.assign(u, { account: 'premium', plan: order.plan, planLabel: plan?.label || '', expiresAt: plan?.days ? inDays(plan.days) : null, daysLeft: plan?.days ?? null });
      }
      return { order: clone(order) };
    }
    return { ok: true };
  }
  if (entity === 'projects') {
    if (!id && method === 'GET') return { projects: [] };
    if (!id && method === 'POST') return { project: { id: uuid(), title: body.title, description: body.description || '', visibility: body.visibility || 'private', folders: [], folderCount: 0, version: 0, role: 'owner' } };
    error('Projects need a signed-in account outside the preview.');
  }
  if (path === '/auth/profile') { Object.assign(user, body); return { user: clone(user) }; }
  if (path.startsWith('/auth/')) error('This preview uses a sample account. Run the full app to create real accounts.');
  if (path === '/stats') return { stats: { totalCards: cards.length, due: cards.filter(c => !c.progress?.dueAt || new Date(c.progress.dueAt) <= new Date()).length, reviewed: reviews.length, reviewsToday: reviews.length, mastered: cards.filter(c => c.progress.interval >= 21).length, goal: user.dailyGoal } };
  if (entity === 'folders') {
    if (!id && method === 'GET') return { folders: clone(folders.filter(f => !f.archived && (!path.includes('explore') || f.visibility === 'global'))) };
    if (id === 'archived') return { folders: clone(folders.filter(f => f.archived)) };
    if (!id && method === 'POST') { const folder = { ...body, id: uuid(), owner: clone(user), role: 'owner', members: [], memberCount: 1, cardCount: 0, version: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; folders.unshift(folder); return { folder: clone(folder) }; }
    const folder = folders.find(f => f.id === id); if (!folder) error('Folder not found.');
    if (action === 'cards' && method === 'GET') return { cards: clone(cards.filter(c => c.folder === id)) };
    if (action === 'activity') return { activity: clone(activity.filter(a => a.folder === id)) };
    if (!action && method === 'GET') return { folder: clone(folder) };
    if (action === 'save') { folder.saved = body.saved; return { ok: true }; }
    if (action === 'copy') { const copy = { ...clone(folder), id: uuid(), title: `${folder.title} (copy)`, owner: clone(user), role: 'owner', members: [], visibility: 'private', version: 0, originalCreator: folder.owner.username }; folders.unshift(copy); cards.push(...cards.filter(c => c.folder === id).map(c => ({ ...clone(c), id: uuid(), folder: copy.id, progress: { version: 0, interval: 0, repetitions: 0, bookmarked: false } }))); return { folder: clone(copy) }; }
    if (folder.role !== 'owner' && folder.role !== 'editor') error('This folder is read-only. Make a copy to edit it.');
    if (action === 'images') { const file = body.get('image'); const imageId = uuid(); images[imageId] = URL.createObjectURL(file); return { id: imageId, url: images[imageId] }; }
    if (action === 'members') { if (folder.role !== 'owner') error('Only the owner can manage access.'); const target = collaborators.find(c => c.username === body.username.replace('@', '')); if (!target) error('In this preview, try @alex or @maya. Real invitations require the backend.'); folder.members = folder.members.filter(m => m.user.id !== target.id); if (body.role !== 'remove') folder.members.push({ user: target, role: body.role }); folder.memberCount = folder.members.length + 1; folder.version++; return { folder: clone(folder) }; }
    if (action === 'archive') { folder.archived = body.archived; return { ok: true }; }
    if (action === 'cards' && method === 'POST') { const card = { ...body, id: uuid(), folder: id, version: 0, progress: { version: 0, repetitions: 0, interval: 0 } }; cards.push(card); folder.cardCount++; activity.unshift({ id: uuid(), folder: id, actor: clone(user), action: 'card.created', detail: body.front.text || 'Image card', createdAt: new Date().toISOString() }); return { card: clone(card) }; }
    if (!action && method === 'PATCH') { if (body.version !== folder.version) error('This folder changed. Please refresh.'); Object.assign(folder, body, { version: folder.version + 1 }); return { folder: clone(folder) }; }
  }
  if (entity === 'cards') {
    const card = cards.find(c => c.id === id); if (!card) error('Card not found.');
    if (action === 'revisions') return { revisions: clone(revisions[id] || []) };
    if (action === 'bookmark') { card.progress.bookmarked = body.bookmarked; return { ok: true }; }
    const folder = folders.find(f => f.id === card.folder); if (!['owner', 'editor'].includes(folder.role)) error('This folder is read-only.');
    if (method === 'DELETE') { cards = cards.filter(c => c.id !== id); folder.cardCount--; return { ok: true }; }
    if (method === 'PATCH') { if (body.version !== card.version) error('This card changed. Reopen it to see the latest version.'); (revisions[id] ||= []).unshift({ id: uuid(), version: card.version, snapshot: clone(card), editor: clone(user), createdAt: new Date().toISOString() }); Object.assign(card, body, { version: card.version + 1 }); return { card: clone(card) }; }
  }
  if (entity === 'reviews') { const existing = reviews.find(r => r.requestId === body.requestId); if (existing) return { progress: clone(existing.result) }; const card = cards.find(c => c.id === body.cardId); if (body.version !== card.progress.version) error('This card has already been reviewed.'); const interval = { again: 0, hard: 1, good: Math.max(1, (card.progress.interval || 0) * 2), easy: Math.max(4, (card.progress.interval || 0) * 3) }[body.rating]; Object.assign(card.progress, { version: card.progress.version + 1, repetitions: body.rating === 'again' ? 0 : card.progress.repetitions + 1, interval, dueAt: new Date(Date.now() + (interval ? interval * 86400000 : 600000)).toISOString() }); reviews.push({ ...body, result: clone(card.progress) }); return { progress: clone(card.progress) }; }
  error('This action is not available.');
}
export const demoImage = id => images[id];
