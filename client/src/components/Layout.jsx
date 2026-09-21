import { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { LibraryBig, Compass, Users, ChartNoAxesCombined, Plus, ArrowUpRight, Settings2, PanelLeftClose, Menu as MenuIcon, Search, Command, Archive, LogOut, Layers, Swords } from 'lucide-react';
import { Avatar, Button, Modal } from './ui';
import { useApp, useLoad } from '../hooks/useApp';
import { api } from '../services/api';
import FolderModal from './FolderModal';
import ThemeToggle from './ThemeToggle';
import { toast } from 'sonner';
export default function Layout() {
  const { user, isDemo, revision, setUser } = useApp(); const navigate = useNavigate();
  const [create, setCreate] = useState(false), [mobile, setMobile] = useState(false), [help, setHelp] = useState(false), [query, setQuery] = useState('');
  const { data } = useLoad(() => api('/folders'), [revision]);
  const nav = [['/', LibraryBig, 'My library'], ['/shared', Users, 'Shared with me'], ['/explore', Compass, 'Explore'], ['/progress', ChartNoAxesCombined, 'My progress'], ...(isDemo ? [] : [['/rooms', Swords, 'Live quiz']])];
  return <div className="app-shell">
    {mobile && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
    <aside className={`sidebar ${mobile ? 'open' : ''}`}>
      <Link className="brand" to="/" onClick={() => setMobile(false)}><img src="/favicon.svg" alt=""/>recall<span className="brand-period">.</span></Link>
      <Button className="primary sidebar-create" onClick={() => setCreate(true)}><Plus size={19}/> Create a folder</Button>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(([to, Icon, title]) => <NavLink key={to} to={to} end onClick={() => setMobile(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={19}/><span>{title}</span>{to === '/' && <span className="nav-count">{data?.folders?.length || 0}</span>}</NavLink>)}</nav>
      <div className="nav-caption folder-caption">YOUR FOLDERS <button className="icon-button" aria-label="Create another folder" onClick={() => setCreate(true)}><Plus size={15}/></button></div>
      <div className="sidebar-folders">{data?.folders?.filter(f => f.role === 'owner').slice(0, 5).map(f => <NavLink key={f.id} to={`/folders/${f.id}`} onClick={() => setMobile(false)} className="folder-link"><span className={`folder-dot ${f.color}`}/><span>{f.title}</span></NavLink>)}</div>
      <div className="sidebar-bottom"><button className="small-tip" onClick={() => setHelp(true)}><span className="tip-icon"><Layers size={20}/></span><strong>A little learning, every day.</strong><span>Your future self will thank you.</span><span className="tip-link">Make it a habit <ArrowUpRight size={14}/></span></button><NavLink to="/archive" className="nav-link"><Archive size={18}/> Archived folders</NavLink><NavLink to="/settings" className="nav-link"><Settings2 size={18}/> Settings</NavLink><div className="account"><Avatar user={user}/><div><strong>{user?.name || 'Guest'}</strong><span>@{user?.username || 'guest'}</span></div>{!isDemo && <button aria-label="Sign out" className="icon-button" onClick={async () => { try { await api('/auth/logout', { method: 'POST' }); setUser(null); navigate('/'); } catch (e) { toast.error(e.message); } }}><LogOut size={17}/></button>}</div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" aria-label="Open navigation" onClick={() => setMobile(true)}><MenuIcon size={22}/></button><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Your learning space</strong></div><form className="global-search" onSubmit={e => { e.preventDefault(); navigate(`/?q=${encodeURIComponent(query)}`); }}><Search size={17}/><input aria-label="Search folders" placeholder="Find a folder…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>↵</kbd></form><ThemeToggle/><Link to="/settings" aria-label="Your profile"><Avatar user={user} small/></Link></header>
      {isDemo && <div className="demo-banner"><span className="demo-pill">INTERACTIVE PREVIEW</span><span>Try the sample workspace. Changes reset on refresh; accounts and live sharing require the backend.</span></div>}
      <main className="main-content"><Outlet/></main><footer className="app-footer"><span>Made for a curious mind.</span><span>One card at a time.</span></footer>
    </div>
    {create && <FolderModal onClose={() => setCreate(false)}/>}
    <Modal open={help} onClose={() => setHelp(false)} title="Make room for a little learning" description="A small routine is easier to keep."><div className="help-copy"><p>Choose a daily goal you can comfortably finish. Start with a short review, try to recall the answer, then flip the card.</p><p>Rate each answer honestly. Recall will bring difficult cards back sooner and give familiar cards more space.</p><Button className="primary" onClick={() => { setHelp(false); navigate('/settings'); }}>Set your daily goal <ArrowUpRight size={17}/></Button></div></Modal>
  </div>;
}
