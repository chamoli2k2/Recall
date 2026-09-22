import { useCallback, useEffect, useState } from 'react';
const KEY = 'recall-theme';
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const resolveTheme = (preference = read()) => preference === 'dark' || preference === 'light' ? preference : systemDark() ? 'dark' : 'light';
function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#2a2834' : '#5a45e0');
}
// Theme preference: explicit 'light' | 'dark' saved in localStorage, otherwise follows the OS. Shared across all mounted toggles.
export function useTheme() {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme || resolveTheme()));
  useEffect(() => {
    apply(theme);
    const sync = () => setTheme(document.documentElement.dataset.theme);
    const observer = new MutationObserver(sync); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = matchMedia('(prefers-color-scheme: dark)'); const onSystem = () => { if (!read()) setTheme(resolveTheme(null)); }; media.addEventListener('change', onSystem);
    return () => { observer.disconnect(); media.removeEventListener('change', onSystem); };
  }, [theme]);
  const toggle = useCallback(() => { const next = theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, next); } catch {} setTheme(next); }, [theme]);
  return { theme, isDark: theme === 'dark', toggle };
}
