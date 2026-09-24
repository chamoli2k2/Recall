import { hasDashboard, hasPremium } from '../../../shared/account.js';
import { assert } from '../utils/errors.js';

export const requirePremium = (req, _res, next) => {
  try { assert(hasPremium(req.user), 402, 'This is a Premium feature. Upgrade to continue.', 'PREMIUM_REQUIRED'); next(); }
  catch (e) { next(e); }
};

/**
 * Guards anything where reaching the person afterwards matters. Signing up with somebody else's
 * address is free, so before money changes hands the address has to be proven: a receipt, a refund,
 * or a dispute all need to land with the person who actually paid.
 */
export const requireVerifiedEmail = (req, _res, next) => {
  try {
    assert(req.user?.emailVerifiedAt, 403, 'Please confirm your email address first. You can send yourself a link from Settings.', 'EMAIL_UNVERIFIED');
    next();
  } catch (e) { next(e); }
};

export const requireDashboard = (req, _res, next) => {
  try { assert(hasDashboard(req.user), 403, 'This dashboard is for admins.'); next(); }
  catch (e) { next(e); }
};
