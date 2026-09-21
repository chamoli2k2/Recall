export class AppError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
export const assert = (condition, status, message, code) => { if (!condition) throw new AppError(status, message, code); };
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
