import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isDemo } from '../services/api';
import { reauthRealtime } from '../services/realtime';
const Context = createContext();
export function AppProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => { api('/auth/me').then(d => setUser(d.user)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  // The socket authenticates from the session cookie, so it must reconnect when the signed-in user changes.
  const userId = user?.id ?? null; useEffect(() => { if (!loading) reauthRealtime(); }, [userId, loading]);
  return <Context.Provider value={{ user, setUser, loading, error, refresh, revision, isDemo }}>{children}</Context.Provider>;
}
export const useApp = () => useContext(Context);
export function useLoad(loader, dependencies = []) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); setError(''); loader().then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, dependencies);
  return { data, loading, error, setData };
}
