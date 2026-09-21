import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isDemo } from '../services/api';
const Context = createContext();
export function AppProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => { api('/auth/me').then(d => setUser(d.user)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <Context.Provider value={{ user, setUser, loading, error, refresh, revision, isDemo }}>{children}</Context.Provider>;
}
export const useApp = () => useContext(Context);
export function useLoad(loader, dependencies = []) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); setError(''); loader().then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, dependencies);
  return { data, loading, error, setData };
}
