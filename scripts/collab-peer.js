#!/usr/bin/env node
// Development helper: simulates a second collaborator so you can watch presence, live events and CRDT co-editing
// in a single browser. Signs in over HTTP, joins the folder room, marks a card as being edited and (optionally) types
// into the card's shared document character by character.
// Usage: node scripts/collab-peer.js <folderId> <username> <password> [--type "text to append"] [--seconds 60] [--url http://localhost:4000]
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
const args = process.argv.slice(2); const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : args[i + 1]; };
const [folderId, username, password] = args; const base = opt('url', 'http://localhost:4000'), typing = opt('type', null), seconds = Number(opt('seconds', 60));
if (!folderId || !username || !password) { console.error('Usage: node scripts/collab-peer.js <folderId> <username> <password> [--type "text"] [--seconds 60] [--url http://localhost:4000]'); process.exit(2); }
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ identifier: username, password }) });
if (!login.ok) { console.error('Login failed:', login.status); process.exit(1); }
const cookie = login.headers.get('set-cookie').split(';')[0];
const { cards } = await (await fetch(`${base}/api/folders/${folderId}/cards`, { headers: { cookie } })).json(); const cardId = cards?.[0]?.id;
const socket = io(base, { transports: ['websocket'], extraHeaders: { cookie, origin: base } });
socket.on('connect', () => socket.emit('folder:join', folderId, res => {
  if (!res.ok) { console.error('Join failed:', res.error); process.exit(1); }
  console.log(`joined as ${username}; here now: ${res.presence.map(p => p.user.username).join(', ')}`);
  if (!cardId) return; socket.emit('card:editing', folderId, cardId);
  if (typing == null) return;
  socket.emit('doc:join', cardId, res => {
    if (!res.ok) { console.error('doc:join failed:', res.error); return; }
    const doc = new Y.Doc(); Y.applyUpdate(doc, new Uint8Array(res.state)); const awareness = new Awareness(doc);
    awareness.setLocalStateField('user', { name: `${username} (simulated)`, color: '#0ea5e9', colorLight: '#0ea5e933' });
    const announce = () => socket.emit('doc:awareness', cardId, encodeAwarenessUpdate(awareness, [doc.clientID]));
    doc.on('update', (u, origin) => { if (origin !== 'remote') socket.emit('doc:update', cardId, u); });
    socket.on('doc:update', (id, u) => { if (id === cardId) Y.applyUpdate(doc, new Uint8Array(u), 'remote'); });
    socket.on('doc:peer-joined', announce); announce();
    const text = doc.getText('back'); const chars = [...typing]; let i = 0;
    const timer = setInterval(() => {
      if (i >= chars.length) { clearInterval(timer); console.log('back is now:', JSON.stringify(text.toString())); return; }
      text.insert(text.length, chars[i++]); const pos = Y.createRelativePositionFromTypeIndex(text, text.length); awareness.setLocalStateField('cursor', { anchor: pos, head: pos }); announce();
    }, 120);
  });
}));
socket.on('folder:event', e => console.log(`event ${e.type} by ${e.actor?.username}: ${e.detail || ''}`));
socket.on('folder:revoked', () => { console.log('access revoked'); process.exit(0); });
setTimeout(() => { socket.disconnect(); process.exit(0); }, seconds * 1000);
