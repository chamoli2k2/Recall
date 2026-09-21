// Mirrors server/src/realtime/presence.js so a user has the same colour in presence lists and remote cursors.
const PALETTE = ['#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#f97316', '#6366f1', '#14b8a6'];
export const colorFor = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
