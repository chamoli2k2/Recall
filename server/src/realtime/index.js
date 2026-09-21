import { Server } from 'socket.io';
import { Session, User, Card, CardDoc } from '../models/index.js';
import { hashToken } from '../middleware/auth.js';
import { accessFolder } from '../services/accessService.js';
import { onEvent } from './bus.js';
import { PresenceStore } from './presence.js';
import { DocStore } from './docs.js';
const parseCookies = header => Object.fromEntries((header || '').split(';').map(p => p.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const same = (origin, host) => { try { return !!origin && new URL(origin).host === host; } catch { return false; } };
export const presence = new PresenceStore();
export const docs = new DocStore({
  load: async cardId => { const d = await CardDoc.findOne({ card: cardId }).select('+state'); return d ? { state: d.state, updatedAt: d.updatedAt } : null; },
  save: (cardId, state) => CardDoc.updateOne({ card: cardId }, { $set: { state } }, { upsert: true })
});
/** Attaches the realtime layer to the HTTP server. Sockets only observe; every mutation still goes through HTTP + transactions. */
export function attachRealtime(httpServer, origins) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    allowRequest: (req, cb) => { const o = req.headers.origin; cb(null, !o || origins.includes(o) || same(o, req.headers.host)); },
    maxHttpBufferSize: 256 * 1024, pingInterval: 20000, pingTimeout: 25000
  });
  // Authenticate from the same HttpOnly session cookie the API uses. Anonymous sockets may watch public folders.
  io.use(async (socket, next) => {
    try { const token = parseCookies(socket.handshake.headers.cookie).recall_session; if (token) { const s = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }); if (s) socket.data.user = await User.findById(s.user); } next(); } catch (e) { next(e); }
  });
  const room = id => `folder:${id}`, docRoom = id => `doc:${id}`;
  const broadcastPresence = folderId => io.to(room(folderId)).emit('presence', folderId, presence.list(folderId));
  io.on('connection', socket => {
    socket.data.docs = new Map();
    socket.on('folder:join', async (folderId, ack = () => {}) => {
      try { const folder = await accessFolder(folderId, socket.data.user); socket.join(room(folderId)); if (socket.data.user) { presence.join(folderId, socket.id, socket.data.user); broadcastPresence(folderId); } ack({ ok: true, presence: presence.list(folderId), version: folder.version }); }
      catch (e) { ack({ ok: false, error: e.status === 404 ? 'Folder not found.' : 'No access.' }); }
    });
    socket.on('folder:leave', folderId => { socket.leave(room(folderId)); presence.leave(folderId, socket.id); broadcastPresence(folderId); });
    socket.on('card:editing', (folderId, cardId) => { if (presence.setEditing(folderId, socket.id, cardId)) broadcastPresence(folderId); });
    socket.on('doc:join', async (cardId, ack = () => {}) => {
      try {
        const card = await Card.findById(cardId); if (!card) throw new Error('Card not found.');
        await accessFolder(card.folder, socket.data.user, 'editor');
        const doc = await docs.acquire(cardId, card); socket.data.docs.set(cardId, String(card.folder)); socket.join(docRoom(cardId));
        socket.to(docRoom(cardId)).emit('doc:peer-joined', cardId); // existing peers re-announce awareness for the newcomer
        ack({ ok: true, state: Buffer.from(docs.state(cardId) || new Uint8Array()) , version: card.version });
      } catch (e) { ack({ ok: false, error: e.status === 403 ? 'You need editor access to co-edit.' : 'Card not found.' }); }
    });
    socket.on('doc:update', (cardId, update) => { if (!socket.data.docs.has(cardId) || !update) return; if (docs.apply(cardId, update)) socket.to(docRoom(cardId)).emit('doc:update', cardId, update); });
    socket.on('doc:awareness', (cardId, update) => { if (socket.data.docs.has(cardId) && update) socket.to(docRoom(cardId)).emit('doc:awareness', cardId, update); });
    const leaveDoc = async cardId => { if (!socket.data.docs.has(cardId)) return; socket.data.docs.delete(cardId); socket.leave(docRoom(cardId)); socket.to(docRoom(cardId)).emit('doc:peer-left', cardId, socket.id); await docs.release(cardId); };
    socket.on('doc:leave', leaveDoc);
    socket.on('disconnect', async () => { for (const f of presence.drop(socket.id)) broadcastPresence(f); for (const cardId of [...socket.data.docs.keys()]) await leaveDoc(cardId); });
  });
  // Committed domain events fan out to everyone watching the folder. Membership changes re-check every watcher's access.
  onEvent(async event => {
    io.to(room(event.folderId)).emit('folder:event', event);
    if (event.type !== 'folder.members.changed' && event.type !== 'folder.updated') return;
    for (const socketId of [...(io.sockets.adapter.rooms.get(room(event.folderId)) || [])]) {
      const socket = io.sockets.sockets.get(socketId); if (!socket) continue;
      try { await accessFolder(event.folderId, socket.data.user); } catch {
        socket.leave(room(event.folderId)); presence.leave(event.folderId, socket.id);
        for (const [cardId, folderId] of [...socket.data.docs]) if (folderId === event.folderId) { socket.data.docs.delete(cardId); socket.leave(docRoom(cardId)); await docs.release(cardId); }
        socket.emit('folder:revoked', event.folderId);
      }
    }
    broadcastPresence(event.folderId);
  });
  return io;
}
