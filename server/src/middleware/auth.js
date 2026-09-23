import crypto from 'node:crypto';
import { Session, User } from '../models/index.js';
import { assert, asyncHandler } from '../utils/errors.js';
import { BRAND, sessionCookieNames } from '../../../shared/brand.js';

/** The token on a request, under whichever name it was issued. */
export const sessionToken = req => { for (const n of sessionCookieNames) if (req.cookies?.[n]) return req.cookies[n]; return null; };
export const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
export const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 });
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = sessionToken(req);
  if (token) {
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (session) req.user = await User.findById(session.user);
  }
  next();
});
export const requireAuth = (req, _res, next) => { try { assert(req.user, 401, 'Sign in to continue.'); next(); } catch (e) { next(e); } };
export async function createSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({ tokenHash: hashToken(token), user: user.id, expiresAt: new Date(Date.now() + cookieOptions().maxAge) });
  res.cookie(BRAND.sessionCookie, token, cookieOptions());
}
