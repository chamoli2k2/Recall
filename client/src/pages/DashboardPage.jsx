import { useState } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useApp, useLoad } from '../hooks/useApp';
import { Button, Loading, ErrorState, Empty } from '../components/ui';
import { ACCOUNTS, isSuperadmin } from '../../../shared/account.js';
export default function DashboardPage() {
  const { user, revision, refresh } = useApp();
  const [tab, setTab] = useState('users');
  const [q, setQ] = useState('');
  const { data, loading, error } = useLoad(() => api(`/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`), [revision, q]);
  const { data: orders, loading: lo, error: eo } = useLoad(() => api('/admin/orders'), [revision]);
  async function setAccount(id, account) {
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body: { account } }); refresh(); toast.success('Role updated'); }
    catch (e) { toast.error(e.message); }
  }
  async function decide(id, status) {
    try { await api(`/admin/orders/${id}`, { method: 'PATCH', body: { status } }); refresh(); toast.success(status === 'approved' ? 'Premium granted' : 'Request declined'); }
    catch (e) { toast.error(e.message); }
  }
  const people = data?.users || [];
  const pending = (orders?.orders || []).filter(o => o.status === 'pending');
  return <>
    <div className="page-heading"><div><span className="eyebrow">STAFF</span><h1>Dashboard</h1><p>Manage accounts and confirm Premium payments. {isSuperadmin(user) ? 'Superadmin can assign any role.' : 'Admins can set Normal or Premium.'}</p></div></div>
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users {people.length ? <span>{people.length}</span> : null}</button>
      <button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Premium requests {pending.length ? <span>{pending.length}</span> : null}</button>
    </div>
    {tab === 'users' && <>
      <form className="folder-search dash-search" onSubmit={e => e.preventDefault()}><input aria-label="Search users" placeholder="Search name, username, email" value={q} onChange={e => setQ(e.target.value)}/></form>
      {loading ? <Loading/> : error ? <ErrorState message={error}/> : !people.length ? <Empty title="No users" text="Try another search."/> : <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Person</th><th>Email</th><th>Role</th></tr></thead><tbody>{people.map(p => <tr key={p.id}><td><strong>{p.name}</strong><span>@{p.username}</span></td><td>{p.email || '—'}</td><td>{p.id === user.id ? <span className="dash-self">{p.account} · you</span> : <select aria-label={`Role for ${p.username}`} value={p.account || 'normal'} onChange={e => setAccount(p.id, e.target.value)}>{ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}</select>}</td></tr>)}</tbody></table></div>}
    </>}
    {tab === 'orders' && (lo ? <Loading/> : eo ? <ErrorState message={eo}/> : !(orders?.orders || []).length ? <Empty title="No Premium requests" text="When someone submits the buy form, they appear here."/> : <ul className="people-list">{orders.orders.map(o => <li key={o.id} className="order-row"><div className="person-row"><Shield size={16}/><div><strong>{o.name}</strong><span>{o.email} · {o.phone} · {o.country}</span><span>{o.address}</span><span>{o.status}{o.user?.username ? ` · @${o.user.username}` : ''}</span></div>{o.hasProof && <a className="proof-link" href={o.proofUrl} target="_blank" rel="noreferrer"><img className="proof-thumb" src={o.proofUrl} alt="Payment screenshot"/></a>}</div>{o.status === 'pending' && <div className="person-actions"><Button className="primary" onClick={() => decide(o.id, 'approved')}>Approve</Button><Button className="secondary" onClick={() => decide(o.id, 'declined')}>Decline</Button></div>}</li>)}</ul>)}
  </>;
}
