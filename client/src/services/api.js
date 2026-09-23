import { demoRequest, demoImage } from './demoApi';
import { ApiError } from './errors';
import { BRAND } from '../../../shared/brand.js';
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, options = {}) {
  if (isDemo) return demoRequest(path, options);
  const isForm = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${base}/api${path}`, { ...options, credentials: 'include', headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers }, body: options.body && !isForm ? JSON.stringify(options.body) : options.body });
  } catch (cause) {
    // fetch only rejects when the request never completed: offline, DNS, CORS, or a dead server.
    throw new ApiError(`${BRAND.name} could not reach the server. Check your connection and try again.`, { code: 'NETWORK', details: { cause: cause?.message } });
  }
  const requestId = response.headers.get('x-request-id');
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new ApiError(`The ${BRAND.name} API is unavailable. Start the Express server and check your database connection.`, { status: response.status, code: 'NOT_JSON', requestId });
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'Request failed.', { status: response.status, code: data.code || 'ERROR', requestId: data.requestId || requestId, details: data.details });
  return data;
}
export const imageUrl = id => !id ? '' : isDemo ? demoImage(id) : `${base}/api/media/${id}`;
