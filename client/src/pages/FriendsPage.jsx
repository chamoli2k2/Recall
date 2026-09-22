import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { reportError } from '../services/errors';
import { useApp, useLoad } from '../hooks/useApp';
import { Avatar, Button, Loading, ErrorState, Empty } from '../components/ui';
export default function FriendsPage() {
  const { revision, refresh } = useApp();
  const [tab, setTab] = useState('friends');
  const { data: friends, loading: lf, error: ef } = useLoad(() => api('/me/friends'), [revision]);
  const { data: requests, loading: lr, error: er } = useLoad(() => api('/me/requests'), [revision]);
  const people = tab === 'friends' ? friends?.people || [] : requests?.people || [];
  const loading = tab === 'friends' ? lf : lr; const error = tab === 'friends' ? ef : er;
  async function act(username, path, method = 'POST') {
    try { await api(`/users/${username}/${path}`, { method }); refresh(); toast.success(path === 'connect/accept' ? 'You are now friends' : 'Request declined'); }
    catch (e) { reportError(e); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">YOUR PEOPLE</span><h1>Friends</h1><p>Connect with learners you know. Following stays one-way; friendship needs a yes.</p></div></div>
    <div className="tabs" role="tablist">{[['friends', `Friends${friends?.people?.length ? ` ${friends.people.length}` : ''}`], ['requests', `Requests${requests?.people?.length ? ` ${requests.people.length}` : ''}`]].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {loading ? <Loading/> : error ? <ErrorState message={error}/> : !people.length ? <Empty title={tab === 'friends' ? 'No friends yet' : 'No pending requests'} text={tab === 'friends' ? 'Search for someone and send a connection request from their profile.' : 'When someone wants to connect, they will appear here.'}/> : <ul className="people-list">{people.map(p => <li key={p.id}><Link to={`/u/${p.username}`} className="person-row"><Avatar user={p}/><div><strong>{p.name}</strong><span>@{p.username}</span></div></Link>{tab === 'requests' && <div className="person-actions"><Button className="primary" onClick={() => act(p.username, 'connect/accept')}><Check size={15}/> Accept</Button><Button className="secondary" onClick={() => act(p.username, 'connect/decline')}><X size={15}/> Decline</Button></div>}</li>)}</ul>}
    <p className="home-community-note"><UserPlus size={14}/> Follow is open to anyone. A connection request has to be accepted before you become friends.</p>
  </>;
}
