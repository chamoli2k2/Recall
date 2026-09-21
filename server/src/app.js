import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import healthRoutes from './routes/health.js';
import { optionalAuth } from './middleware/auth.js';
export function createApp() {
  const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:4173').split(',').map(v => v.trim());
  app.use(helmet({ contentSecurityPolicy: { directives: { "img-src": ["'self'", 'blob:', 'data:'], "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"], "connect-src": ["'self'", ...origins] } } }));
  app.use(cors({ origin: origins, credentials: true }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && ((req.headers.origin && !origins.includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site')) return res.status(403).json({ error: 'Request origin is not allowed.' }); next(); });
  app.use('/api', healthRoutes);
  app.use(express.json({ limit: '256kb' })); app.use(cookieParser()); app.use('/api', optionalAuth, routes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', 'dist');
  app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.use((err, _req, res, _next) => {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (err.code === 11000) return res.status(409).json({ error: 'That username, email, or unique record already exists.' });
    if (err.name === 'CastError') return res.status(404).json({ error: 'Record not found.' });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Images must be under 5 MB.' });
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.', code: err.code });
  });
  return app;
}
