import { Notification, User } from '../models/index.js';

/**
 * Observer pattern. Producers (follows, connections, premium orders) publish an event and know
 * nothing about what happens next. Channels subscribe and each decides how to handle it: one
 * stores a row, one pushes over the socket, another could send email later.
 *
 * Channels run in registration order so a later channel can reuse what an earlier one produced,
 * and a throwing channel is logged rather than propagated, because a failed notification must never roll
 * back the action that triggered it.
 */
export class NotificationCenter {
  #channels = [];
  subscribe(channel) { this.#channels.push(channel); return () => { this.#channels = this.#channels.filter(c => c !== channel); }; }
  get channelCount() { return this.#channels.length; }
  async publish(event) {
    for (const channel of this.#channels) {
      try { await channel(event); }
      catch (e) { console.error(`[notifications] ${channel.name || 'channel'} failed for ${event.type}:`, e.message); }
    }
    return event;
  }
}

export const notifications = new NotificationCenter();

/** Accepts a mongoose document, a lean row, a raw ObjectId, or a plain id string. */
function idOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._bsontype === 'ObjectId') return value.toString(); // `.id` on an ObjectId is the raw buffer, not the hex
  if (value._id) return String(value._id);
  return value.id ? String(value.id) : null;
}
const actorRef = a => !a ? null : { id: idOf(a), name: a.name || '', username: a.username || '' };
export const presentNotification = (row, actor) => ({
  id: String(row.id || row._id),
  type: row.type,
  data: row.data || {},
  createdAt: row.createdAt,
  readAt: row.readAt || null,
  actor: actor !== undefined ? actorRef(actor) : (row.actor ? actorRef(row.actor) : null),
});

/** Channel: durable history, so a notification survives a reload or a disconnected client. */
export async function persistChannel(event) {
  event.stored = await Notification.create({ user: event.to, type: event.type, actor: actorRef(event.actor)?.id || null, data: event.data });
}
notifications.subscribe(persistChannel);

/** Fan a single event out to one recipient. Callers pass a user document or id as `actor`. */
export const notify = (to, type, { actor = null, data = {} } = {}) => {
  const recipient = idOf(to);
  return recipient ? notifications.publish({ to: recipient, type, actor, data }) : Promise.resolve(null);
};

/** Fan out to everyone who can act on it from the dashboard. */
export async function notifyStaff(type, { actor = null, data = {} } = {}) {
  const staff = await User.find({ account: { $in: ['admin', 'superadmin'] } }).select('_id').lean();
  return Promise.all(staff.filter(s => String(s._id) !== actorRef(actor)?.id).map(s => notify(s._id, type, { actor, data })));
}

export async function listNotifications(user, limit = 30) {
  const [rows, unread] = await Promise.all([
    Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(limit).populate('actor', 'name username').lean(),
    Notification.countDocuments({ user: user.id, readAt: null }),
  ]);
  return { notifications: rows.map(r => presentNotification(r, r.actor || null)), unread };
}

export async function markRead(user, ids) {
  const filter = { user: user.id, readAt: null };
  if (ids?.length) filter._id = { $in: ids };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return Notification.countDocuments({ user: user.id, readAt: null });
}
