import { planById } from './account.js';

export const NOTIFICATION_TYPES = ['follow', 'connect.request', 'connect.accepted', 'premium.requested', 'premium.approved', 'premium.declined'];

const who = n => n.actor?.name || n.actor?.username || 'Someone';
const planLabel = n => planById(n.data?.plan)?.label || 'Premium';

/** Single source of truth for how a stored notification reads in the UI. */
export function describeNotification(n) {
  switch (n.type) {
    case 'follow':
      return { icon: 'follow', title: `${who(n)} followed you`, body: 'Take a look at their public folders.', href: n.actor ? `/u/${n.actor.username}` : '/friends' };
    case 'connect.request':
      return { icon: 'connect', title: `${who(n)} wants to connect`, body: 'Accept to become friends.', href: '/friends' };
    case 'connect.accepted':
      return { icon: 'friends', title: `${who(n)} accepted your request`, body: 'You are friends now.', href: '/friends' };
    case 'premium.requested':
      return { icon: 'premium', title: `${who(n)} requested ${planLabel(n)}`, body: 'Review the payment screenshot in the dashboard.', href: '/dashboard' };
    case 'premium.approved':
      return { icon: 'premium', title: `Your ${planLabel(n)} plan is active`, body: n.data?.expiresAt ? `Renews or ends on ${new Date(n.data.expiresAt).toLocaleDateString()}.` : 'It never expires.', href: '/premium' };
    case 'premium.declined':
      return { icon: 'declined', title: 'Premium request declined', body: 'Get in touch if you think this is a mistake.', href: '/premium' };
    default:
      return { icon: 'bell', title: 'Something happened', body: '', href: '/' };
  }
}
