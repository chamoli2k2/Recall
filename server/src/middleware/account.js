import { hasDashboard, hasPremium } from '../../../shared/account.js';
import { assert } from '../utils/errors.js';

export const requirePremium = (req, _res, next) => {
  try { assert(hasPremium(req.user), 402, 'This is a Premium feature. Upgrade to continue.', 'PREMIUM_REQUIRED'); next(); }
  catch (e) { next(e); }
};

export const requireDashboard = (req, _res, next) => {
  try { assert(hasDashboard(req.user), 403, 'This dashboard is for admins.'); next(); }
  catch (e) { next(e); }
};
