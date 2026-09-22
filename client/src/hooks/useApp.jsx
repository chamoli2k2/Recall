import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isDemo } from '../services/api';
import { messageFor } from '../services/errors';
import { reauthRealtime } from '../services/realtime';
const Context = createContext();
export function AppProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  // A signed-out visitor is not an error; only a real failure should surface one.
  useEffect(() => { api('/auth/me').then(d => setUser(d.user)).catch(e => { if (e.status !== 401) setError(messageFor(e)); }).finally(() => setLoading(false)); }, []);
  // The socket authenticates from the session cookie, so it must reconnect when the signed-in user changes.
  const userId = user?.id ?? null; useEffect(() => { if (!loading) reauthRealtime(); }, [userId, loading]);
  return <Context.Provider value={{ user, setUser, loading, error, refresh, revision, isDemo }}>{children}</Context.Provider>;
}
export const useApp = () => useContext(Context);
export function useLoad(loader, dependencies = []) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); setError(''); loader().then(d => { if (active) setData(d); }).catch(e => { if (active) setError(messageFor(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, dependencies);
  return { data, loading, error, setData };
}
