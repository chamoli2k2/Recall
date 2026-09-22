import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Bell, UserPlus, Users, Crown, CircleSlash } from 'lucide-react';
import { api } from '../services/api';
import { socket } from '../services/realtime';
import { describeNotification } from '../../../shared/notifications.js';
const ICONS = { follow: UserPlus, connect: UserPlus, friends: Users, premium: Crown, declined: CircleSlash, bell: Bell };
const ago = iso => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
export default function NotificationBell() {
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    try { const d = await api('/notifications'); setItems(d.notifications || []); setUnread(d.unread || 0); } catch { /* the bell stays quiet when the API is unavailable */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return;
    const arrive = n => { setItems(list => [n, ...list.filter(i => i.id !== n.id)].slice(0, 30)); setUnread(u => u + 1); };
    socket.on('notification', arrive);
    return () => socket.off('notification', arrive);
  }, []);
  // Opening the panel is the read receipt: the badge clears, but the unread dots stay until the next fetch.
  async function toggle(next) {
    setOpen(next);
    if (!next) return;
    await load();
    if (unread) { try { await api('/notifications/read', { method: 'POST', body: {} }); setUnread(0); } catch { /* ignore */ } }
  }
  return <Dropdown.Root open={open} onOpenChange={toggle}>
    <Dropdown.Trigger className="icon-button bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
      <Bell size={19}/>{unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
    </Dropdown.Trigger>
    <Dropdown.Portal><Dropdown.Content className="dropdown notif-panel" sideOffset={8} align="end">
      <div className="notif-head"><strong>Notifications</strong>{items.length > 0 && <span>{unread ? `${unread} new` : 'All caught up'}</span>}</div>
      {!items.length ? <p className="notif-empty">Nothing yet. Follows, connection requests, and Premium updates land here.</p>
        : <ul className="notif-list">{items.map(n => {
          const { icon, title, body, href } = describeNotification(n);
          const Icon = ICONS[icon] || Bell;
          return <li key={n.id}><Dropdown.Item asChild><Link to={href} className={`notif-item ${n.readAt ? '' : 'is-unread'}`}>
            <span className={`notif-icon is-${icon}`}><Icon size={15}/></span>
            <span><strong>{title}</strong><span>{body}</span><span className="notif-time">{ago(n.createdAt)}</span></span>
          </Link></Dropdown.Item></li>;
        })}</ul>}
    </Dropdown.Content></Dropdown.Portal>
  </Dropdown.Root>;
}
