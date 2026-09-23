#!/usr/bin/env node
// Standalone external health ping for the app. Runs once and exits; intended for an external scheduler
// (cron, systemd timer, GitHub Actions, or a hosted monitor) on a machine independent of the app server.
// Usage: HEALTHCHECK_URL=https://example.com/api/health node scripts/healthcheck.js
// Exit codes: 0 healthy, 1 unhealthy after retry, 2 misconfigured.
import { pathToFileURL } from 'node:url';
import { BRAND } from '../shared/brand.js';
export const DEFAULTS = { timeoutMs: 10_000, retries: 1 };
const stamp = () => new Date().toISOString();
export const defaultLogger = (level, message) => (level === 'info' ? console.log : console.error)(`${stamp()} [${level}] ${message}`);
export async function checkOnce(url, { fetchImpl = fetch, timeoutMs = DEFAULTS.timeoutMs } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); const started = Date.now();
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'manual', headers: { accept: 'application/json', 'user-agent': `${BRAND.slug}-healthcheck/1.0` } });
    return { ok: res.status === 200, status: res.status, ms: Date.now() - started };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : (err?.cause?.code || err?.message || 'request failed');
    return { ok: false, reason, ms: Date.now() - started };
  } finally { clearTimeout(timer); }
}
export async function run({ url = process.env.HEALTHCHECK_URL, fetchImpl = fetch, timeoutMs = DEFAULTS.timeoutMs, retries = DEFAULTS.retries, logger = defaultLogger } = {}) {
  if (!url || !/^https?:\/\//.test(url)) { logger('error', 'HEALTHCHECK_URL must be set to an http(s) URL, e.g. https://example.com/api/health'); return 2; }
  const attempts = retries + 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await checkOnce(url, { fetchImpl, timeoutMs });
    if (result.ok) { logger('info', `healthy: HTTP ${result.status} in ${result.ms}ms (attempt ${attempt}/${attempts}) ${url}`); return 0; }
    logger('warn', `attempt ${attempt}/${attempts} failed: ${result.reason ?? `HTTP ${result.status}`} after ${result.ms}ms`);
  }
  logger('error', `unhealthy after ${attempts} attempts: ${url}`); return 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await run();
