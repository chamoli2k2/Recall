import { Router } from 'express';
import * as health from '../controllers/healthController.js';
import { asyncHandler as a } from '../utils/errors.js';
// Mounted before session lookup so monitors never trigger a database query via cookies and get a clean 503 when the database is down.
const r = Router();
r.get('/health', health.health);
r.get('/ready', a(health.ready));
export default r;
