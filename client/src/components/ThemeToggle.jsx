import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
export default function ThemeToggle({ className = '', size = 18 }) {
  const { isDark, toggle } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return <button type="button" className={`icon-button theme-toggle ${className}`} aria-label={label} title={label} aria-pressed={isDark} onClick={toggle}>{isDark ? <Sun size={size}/> : <Moon size={size}/>}</button>;
}
