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
import { requestContext, notFoundHandler, errorHandler } from './middleware/errorHandler.js';
export const trustedOrigins = () => (process.env.CLIENT_ORIGIN || 'http://localhost:4173').split(',').map(v => v.trim()).filter(Boolean);
export function createApp() {
  const app = express(); app.disable('x-powered-by'); if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(requestContext);
  const origins = trustedOrigins();
  // connect-src includes ws(s) so the same-origin Socket.IO connection is allowed by CSP in every browser.
  app.use(helmet({ contentSecurityPolicy: { directives: { "img-src": ["'self'", 'blob:', 'data:'], "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"], "connect-src": ["'self'", 'ws:', 'wss:', ...origins] } } }));
  app.use(cors({ origin: origins, credentials: true }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  // CSRF guard for writes. Same-origin requests (Origin host === Host header) are always allowed, so the standard
  // single-service deployment needs no CLIENT_ORIGIN; the allow-list is for separately hosted frontends.
  const sameOrigin = req => { try { return req.headers.origin && new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
  const trustedOrigin = req => !req.headers.origin || origins.includes(req.headers.origin) || sameOrigin(req);
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (!trustedOrigin(req) || req.headers['sec-fetch-site'] === 'cross-site')) return res.status(403).json({ error: 'Request origin is not allowed.' }); next(); });
  app.use('/api', healthRoutes);
  app.use(express.json({ limit: '256kb' })); app.use(cookieParser()); app.use('/api', optionalAuth, routes);
  app.use('/api', notFoundHandler);
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', 'dist');
  app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.use(errorHandler);
  return app;
}
