// In-memory presence per folder room. Pure data structure so it can be unit tested without sockets.
// Scaling note: for multiple server replicas this state (and Socket.IO rooms) must move to a shared adapter such as Redis.
const PALETTE = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#f97316', '#6366f1', '#14b8a6'];
export const colorFor = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
export class PresenceStore {
  constructor() { this.rooms = new Map(); this.sockets = new Map(); }
  join(folderId, socketId, user) {
    if (!this.rooms.has(folderId)) this.rooms.set(folderId, new Map());
    this.rooms.get(folderId).set(socketId, { socketId, user: { id: String(user.id), name: user.name, username: user.username }, color: colorFor(user.id), editing: null, since: Date.now() });
    if (!this.sockets.has(socketId)) this.sockets.set(socketId, new Set()); this.sockets.get(socketId).add(folderId);
  }
  leave(folderId, socketId) { const room = this.rooms.get(folderId); room?.delete(socketId); if (room && !room.size) this.rooms.delete(folderId); this.sockets.get(socketId)?.delete(folderId); }
  setEditing(folderId, socketId, cardId) { const entry = this.rooms.get(folderId)?.get(socketId); if (entry) entry.editing = cardId || null; return !!entry; }
  // Removes a socket from every room and returns the folder ids that changed.
  drop(socketId) { const folders = [...(this.sockets.get(socketId) || [])]; for (const f of folders) this.leave(f, socketId); this.sockets.delete(socketId); return folders; }
  // One entry per user (a user may have several tabs); editing shows any card they are editing.
  list(folderId) {
    const byUser = new Map();
    for (const e of this.rooms.get(folderId)?.values() || []) { const prev = byUser.get(e.user.id); byUser.set(e.user.id, { user: e.user, color: e.color, editing: prev?.editing || e.editing, tabs: (prev?.tabs || 0) + 1 }); }
    return [...byUser.values()];
  }
  socketsIn(folderId) { return [...(this.rooms.get(folderId)?.keys() || [])]; }
}
