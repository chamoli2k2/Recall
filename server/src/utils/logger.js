import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request context follows the call through services, models, and the realtime layer without being
 * threaded through every signature, so a log line written deep in a service still carries the
 * request id that the client saw in its error response.
 */
export const context = new AsyncLocalStorage();
export const runWithContext = (values, fn) => context.run({ ...values }, fn);
export const currentContext = () => context.getStore() || {};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const configured = () => process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
const enabled = level => LEVELS[level] >= (LEVELS[configured()] ?? LEVELS.info);
// Machine-readable in production where something is collecting stdout; readable while developing.
const structured = () => process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

function write(level, message, fields = {}) {
  if (!enabled(level)) return;
  const entry = { level, time: new Date().toISOString(), message, ...currentContext(), ...fields };
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (structured()) return void stream.write(`${JSON.stringify(entry)}\n`);
  const { time, ...rest } = entry;
  const extras = Object.entries(rest).filter(([k]) => k !== 'level' && k !== 'message' && k !== 'stack');
  stream.write(`${time.slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${message}${extras.length ? ` ${extras.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}` : ''}\n`);
  if (rest.stack) stream.write(`${rest.stack}\n`);
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};
