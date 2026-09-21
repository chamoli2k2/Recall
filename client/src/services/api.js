import { demoRequest, demoImage } from './demoApi';
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, options = {}) {
  if (isDemo) return demoRequest(path, options);
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${base}/api${path}`, { ...options, credentials: 'include', headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers }, body: options.body && !isForm ? JSON.stringify(options.body) : options.body });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('The Recall API is unavailable. Start the Express server and check your database connection.');
  const data = await response.json(); if (!response.ok) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; error.code = data.code; throw error; } return data;
}
export const imageUrl = id => !id ? '' : isDemo ? demoImage(id) : `${base}/api/media/${id}`;
