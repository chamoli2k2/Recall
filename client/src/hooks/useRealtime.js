import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { socket, connectRealtime, toBytes } from '../services/realtime';
/** Joins a folder room: live presence list plus committed domain events for that folder. */
export function useFolderRealtime(folderId, { onEvent, onRevoked } = {}) {
  const [presence, setPresence] = useState([]); const [connected, setConnected] = useState(!!socket?.connected);
  const handlers = useRef({ onEvent, onRevoked }); handlers.current = { onEvent, onRevoked };
  useEffect(() => {
    if (!socket || !folderId) return; connectRealtime();
    const join = () => socket.emit('folder:join', folderId, res => { if (res?.ok) setPresence(res.presence || []); });
    const onConnect = () => { setConnected(true); join(); }, onDisconnect = () => { setConnected(false); setPresence([]); };
    const onPresence = (id, list) => { if (id === folderId) setPresence(list); };
    const onFolderEvent = e => { if (e.folderId === folderId) handlers.current.onEvent?.(e); };
    const onRevokedEvent = id => { if (id === folderId) handlers.current.onRevoked?.(); };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('presence', onPresence); socket.on('folder:event', onFolderEvent); socket.on('folder:revoked', onRevokedEvent);
    if (socket.connected) join();
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('presence', onPresence); socket.off('folder:event', onFolderEvent); socket.off('folder:revoked', onRevokedEvent); if (socket.connected) socket.emit('folder:leave', folderId); };
  }, [folderId]);
  const setEditing = useCallback(cardId => { if (socket?.connected && folderId) socket.emit('card:editing', folderId, cardId || null); }, [folderId]);
  return { presence, connected, setEditing };
}
/** Joins (or, with `create`, hosts) a live quiz room and mirrors the server's room snapshot. */
export function useRoom(code, { folderId, options } = {}) {
  const [room, setRoom] = useState(null); const [error, setError] = useState(''); const [joinedCode, setJoinedCode] = useState(null);
  const creating = !code && !!folderId; const joinedRef = useRef(null), keep = useRef(false);
  useEffect(() => {
    if (!socket || (!code && !folderId)) return; connectRealtime(); let cancelled = false;
    // Hosting creates the room, then the page navigates to /rooms/CODE. That re-runs this effect with the new code;
    // since we are already in that room, keep the membership instead of leaving and re-joining (which would destroy it).
    let current = null; if (code && joinedRef.current === code) { current = code; keep.current = true; }
    const handle = res => { if (cancelled) return; if (!res?.ok) { setError(res?.error || 'Could not join this room.'); return; } current = res.code; joinedRef.current = res.code; setJoinedCode(res.code); setRoom(res.room); setError(''); };
    const join = () => creating ? socket.emit('room:create', folderId, options || {}, handle) : socket.emit('room:join', code, handle);
    const onState = state => { if (state.code === current) setRoom(state); };
    const onDisconnect = () => setError('Connection lost. Reconnecting…');
    socket.on('room:state', onState); socket.on('connect', join); socket.on('disconnect', onDisconnect);
    if (socket.connected && !current) join();
    return () => {
      cancelled = true; socket.off('room:state', onState); socket.off('connect', join); socket.off('disconnect', onDisconnect);
      keep.current = false; const leaving = current;
      setTimeout(() => { if (!leaving || keep.current) return; if (socket.connected) socket.emit('room:leave', leaving); if (joinedRef.current === leaving) joinedRef.current = null; }, 0);
    };
  }, [code, folderId]);
  const act = useCallback((event, ...args) => new Promise(resolve => { if (!socket?.connected || !joinedCode) return resolve({ ok: false }); socket.emit(event, joinedCode, ...args, res => resolve(res || { ok: true })); }), [joinedCode]);
  return { room, error, code: joinedCode, start: () => act('room:start'), next: () => act('room:next'), answer: choice => { if (socket?.connected && joinedCode) socket.emit('room:answer', joinedCode, choice); } };
}
/** Opens a card's shared Yjs document for live co-editing. Returns null-ish handles until the server has synced. */
export function useCardDoc(cardId, user, enabled = true) {
  const [state, setState] = useState({ doc: null, awareness: null, ready: false, error: '', version: null });
  const [peers, setPeers] = useState([]);
  useEffect(() => {
    if (!socket || !cardId || !enabled) return; connectRealtime();
    const doc = new Y.Doc(); const awareness = new Awareness(doc); let joined = false, cancelled = false;
    awareness.setLocalStateField('user', { name: user?.name || 'Guest', color: user?.color || '#7c3aed', colorLight: (user?.color || '#7c3aed') + '33' });
    const publishAwareness = () => socket.emit('doc:awareness', cardId, encodeAwarenessUpdate(awareness, [doc.clientID]));
    const onDocUpdate = (update, origin) => { if (origin !== 'remote' && joined) socket.emit('doc:update', cardId, update); };
    const onAwareness = ({ added, updated, removed }, origin) => {
      if (origin === 'local') publishAwareness();
      const list = []; for (const [id, s] of awareness.getStates()) if (id !== doc.clientID && s.user) list.push({ id, ...s.user }); setPeers(list);
    };
    const onRemoteUpdate = (id, update) => { if (id === cardId) Y.applyUpdate(doc, toBytes(update), 'remote'); };
    const onRemoteAwareness = (id, update) => { if (id === cardId) applyAwarenessUpdate(awareness, toBytes(update), 'remote'); };
    const onPeerJoined = id => { if (id === cardId) publishAwareness(); };
    const join = () => socket.emit('doc:join', cardId, res => {
      if (cancelled) return;
      if (!res?.ok) { setState(s => ({ ...s, error: res?.error || 'Live editing unavailable.' })); return; }
      Y.applyUpdate(doc, toBytes(res.state), 'remote'); joined = true; publishAwareness();
      setState({ doc, awareness, ready: true, error: '', version: res.version });
    });
    doc.on('update', onDocUpdate); awareness.on('change', onAwareness);
    socket.on('doc:update', onRemoteUpdate); socket.on('doc:awareness', onRemoteAwareness); socket.on('doc:peer-joined', onPeerJoined); socket.on('connect', join);
    if (socket.connected) join();
    return () => {
      cancelled = true; socket.off('doc:update', onRemoteUpdate); socket.off('doc:awareness', onRemoteAwareness); socket.off('doc:peer-joined', onPeerJoined); socket.off('connect', join);
      removeAwarenessStates(awareness, [doc.clientID], 'local'); if (socket.connected) socket.emit('doc:leave', cardId);
      awareness.destroy(); doc.destroy(); setState({ doc: null, awareness: null, ready: false, error: '', version: null }); setPeers([]);
    };
  }, [cardId, enabled]);
  return { ...state, peers };
}
