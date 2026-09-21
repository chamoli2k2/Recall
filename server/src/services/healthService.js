import mongoose from 'mongoose';
export const READINESS_TIMEOUT_MS = Math.min(Math.max(Number(process.env.READINESS_TIMEOUT_MS) || 2000, 100), 10000);
// Returns true only when the driver reports an open connection and the server answers a ping within timeoutMs.
// Never throws and never returns driver error details, so callers cannot leak connection internals.
export async function checkDatabase({ connection = mongoose.connection, timeoutMs = READINESS_TIMEOUT_MS } = {}) {
  if (connection.readyState !== 1 || !connection.db) return false;
  let timer;
  try {
    await Promise.race([
      connection.db.admin().command({ ping: 1 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Readiness ping timed out')), timeoutMs); })
    ]);
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}
