import { createContext, useContext, useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { api, isDemo } from '../services/api';
import { messageFor } from '../services/errors';
import { reauthRealtime } from '../services/realtime';
import { load, peek, put, register, subscribe, invalidate } from '../services/store';
const Context = createContext();
export function AppProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  // Reloads whatever is on screen, once per distinct request rather than once per component.
  const refresh = useCallback((...keys) => invalidate(...keys), []);
  // A signed-out visitor is not an error; only a real failure should surface one.
  useEffect(() => { api('/auth/me').then(d => setUser(d.user)).catch(e => { if (e.status !== 401) setError(messageFor(e)); }).finally(() => setLoading(false)); }, []);
  // The socket authenticates from the session cookie, so it must reconnect when the signed-in user changes.
  const userId = user?.id ?? null; useEffect(() => { if (!loading) reauthRealtime(); }, [userId, loading]);
  // Signing in or out makes every cached answer belong to the wrong person. The ref skips the first
  // run, which is just the session arriving, not a change of account.
  const lastUser = useRef();
  useEffect(() => { if (lastUser.current !== undefined && lastUser.current !== userId) invalidate(); lastUser.current = userId; }, [userId]);
  return <Context.Provider value={{ user, setUser, loading, error, refresh, isDemo }}>{children}</Context.Provider>;
}
export const useApp = () => useContext(Context);

const EMPTY = { data: null, error: null };
/**
 * Reads `key` from the shared cache, fetching it if nobody has yet. `loader` is optional and only
 * needed when the data is not a plain GET of the key itself, such as two requests combined into one
 * view. Pass `enabled: false` to hold off, which keeps the key stable while a prerequisite loads.
 */
export function useQuery(key, loader, { enabled = true } = {}) {
  const active = enabled && !!key;
  // The loader closes over props that change every render, so the cache calls through a ref and
  // always runs the current one instead of whichever version was around at subscribe time.
  const latest = useRef(loader); latest.current = loader;
  const entry = useSyncExternalStore(
    useCallback(fn => (active ? subscribe(key, fn) : () => {}), [key, active]),
    () => (active ? peek(key) : null) || EMPTY,
  );
  useEffect(() => {
    if (!active) return;
    // Plain GETs need no loader at the call site, so supply one rather than making the store know
    // about the API client.
    const run = () => (latest.current ? latest.current() : api(key));
    register(key, run);
    if (!peek(key)) load(key, run);
  }, [key, active]);
  const refetch = useCallback(() => load(key), [key]);
  return { data: entry.data, error: entry.error ? messageFor(entry.error) : '', loading: active && !peek(key), refetch, setData: data => put(key, data) };
}
