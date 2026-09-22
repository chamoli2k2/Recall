import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hasPremium } from '../../../shared/account.js';
export function PremiumMark({ className = '' }) {
  return <span className={`premium-mark ${className}`} title="Premium"><Crown size={12}/></span>;
}
export function PremiumLock({ children, user, feature = 'This feature' }) {
  if (hasPremium(user)) return children;
  return <Link className="premium-lock" to="/premium"><Crown size={14}/> {feature} · Upgrade</Link>;
}
