import { EventEmitter } from 'node:events';
// Post-commit event bus. Services queue events during a transaction; mutateFolder flushes them only after the
// transaction commits, so realtime subscribers never observe a write that rolled back.
const emitter = new EventEmitter(); emitter.setMaxListeners(50);
const pending = new WeakMap();
export const beginCollecting = session => { pending.set(session, []); };
export const queueEvent = (session, event) => { pending.get(session)?.push(event); };
export const flushEvents = session => { const events = pending.get(session) || []; pending.delete(session); for (const e of events) emitter.emit('event', e); return events; };
export const onEvent = handler => { emitter.on('event', handler); return () => emitter.off('event', handler); };
