import { checkDatabase } from '../services/healthService.js';
import { BRAND } from '../../../shared/brand.js';
// Liveness: proves the Express process is serving requests. No database access, no secrets, always 200.
export const health = (_req, res) => res.json({ ok: true, app: BRAND.slug, storage: 'mongodb' });
// Readiness: proves the app can serve real traffic. 503 when MongoDB is unreachable or slow to answer.
export const ready = async (_req, res) => {
  const database = await checkDatabase();
  res.status(database ? 200 : 503).json({ ok: database, status: database ? 'ready' : 'unavailable', checks: { database: database ? 'up' : 'down' } });
};
