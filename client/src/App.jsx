import { Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { useApp } from './hooks/useApp';
import Layout from './components/Layout';
import LibraryPage from './pages/LibraryPage';
import FolderPage from './pages/FolderPage';
import StudyPage from './pages/StudyPage';
import { AuthPage, SettingsPage, ProgressPage } from './pages/AccountPages';
import { Loading, Empty } from './components/ui';
import { PublicShell, PublicFolderPage, PublicExplorePage, ProfilePage } from './pages/PublicPages';
import RoomPage, { JoinRoomPage } from './pages/RoomPage';
export default function App() {
  const { user, loading } = useApp();
  if (loading) return <div className="boot-screen"><img src="/favicon.svg" alt="Recall"/><Loading/></div>;
  if (!user) return <Routes>
    <Route path="/" element={<PublicShell wide><HomePage/></PublicShell>}/>
    <Route path="/login" element={<AuthPage/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/folders/:id" element={<PublicShell><PublicFolderPage/></PublicShell>}/><Route path="/u/:username" element={<PublicShell><ProfilePage/></PublicShell>}/><Route path="/explore" element={<PublicShell><PublicExplorePage/></PublicShell>}/>
    <Route path="/rooms/:code" element={<Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
  // After signing in, honour a safe same-app `next` path (used by quiz invite links).
  const next = new URLSearchParams(window.location.search).get('next'); const after = <Navigate to={next && /^\/[^/]/.test(next) ? next : '/'} replace/>;
  return <Routes><Route path="login" element={after}/><Route path="signup" element={after}/><Route element={<Layout/>}><Route index element={<LibraryPage/>}/><Route path="shared" element={<LibraryPage mode="shared"/>}/><Route path="explore" element={<LibraryPage mode="explore"/>}/><Route path="archive" element={<LibraryPage mode="archive"/>}/><Route path="folders/:id" element={<FolderPage/>}/><Route path="folders/:id/study" element={<StudyPage/>}/><Route path="u/:username" element={<ProfilePage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="progress" element={<ProgressPage/>}/><Route path="rooms" element={<JoinRoomPage/>}/><Route path="rooms/:code" element={<RoomPage/>}/><Route path="*" element={<Empty title="This page turned over" text="We couldn’t find what you were looking for." action={<Link to="/" className="button primary">Back to library</Link>}/>}/></Route></Routes>;
}
