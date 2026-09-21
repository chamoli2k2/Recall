import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RotateCcw, Layers, Users, Brain, Globe2, LockKeyhole, Sparkles, Search } from 'lucide-react';
import { api } from '../services/api';
import { useLoad } from '../hooks/useApp';
import { FolderIcon, Loading, Avatar, Empty } from '../components/ui';
function matchesFolder(folder, query) {
  if (!query) return true;
  const hay = `${folder.title} ${folder.description} ${folder.tags?.join(' ') || ''} ${folder.owner?.username || ''}`.toLowerCase();
  return hay.includes(query.toLowerCase());
}
const sample = [
  { front: 'What is spaced repetition?', back: 'Reviewing material at increasing intervals, right before you would forget it. Hard cards come back sooner; easy cards drift further out.', tag: 'learning' },
  { front: 'Why does active recall beat re-reading?', back: 'Retrieving an answer from memory strengthens the memory trace far more than passively recognising it on a page.', tag: 'memory' },
  { front: 'What does “optimistic concurrency” mean?', back: 'Proceed without locks and check a version number at save time. If someone else changed it first, you get a conflict instead of a silent overwrite.', tag: 'engineering' }
];
function HeroCard() {
  const [index, setIndex] = useState(0), [flipped, setFlipped] = useState(false); const card = sample[index];
  const next = () => { setFlipped(false); setIndex(i => (i + 1) % sample.length); };
  return <div className="home-hero-card-wrap"><div className="home-hero-card-shadow"/><article className={`home-hero-card ${flipped ? 'answer-visible' : ''}`}>
    <div className="home-hero-card-top"><span>{String(index + 1).padStart(2, '0')} / {flipped ? 'ANSWER' : 'QUESTION'}</span><span className="tag">{card.tag}</span></div>
    <button type="button" className="home-hero-card-body" aria-label={flipped ? 'Show question' : 'Reveal answer'} onClick={() => setFlipped(f => !f)}><p>{flipped ? card.back : card.front}</p><small>{flipped ? 'Tap to see the question' : 'Tap to reveal the answer'}</small></button>
    <div className="home-hero-card-actions">{flipped ? <><button type="button" className="rating again" onClick={next}><span>Again</span></button><button type="button" className="rating good" onClick={next}><span>Good</span></button><button type="button" className="rating easy" onClick={next}><span>Easy</span></button></> : <button type="button" className="text-button" onClick={() => setFlipped(true)}><RotateCcw size={14}/> Flip the card</button>}</div>
  </article></div>;
}
function PublicFolderCard({ folder }) {
  return <Link className={`home-folder ${folder.color}`} to={`/folders/${folder.id}`}>
    <div className="home-folder-cover"><span className="folder-icon"><FolderIcon name={folder.icon} size={26}/></span><span className="visibility-badge"><Globe2 size={11}/> Public</span></div>
    <div className="home-folder-body"><h3>{folder.title}</h3><p>{folder.description || 'A public collection of flashcards.'}</p>
      <div className="home-folder-meta"><span><Avatar user={folder.owner} small/> @{folder.owner?.username}</span><span>{folder.cardCount} cards <ArrowRight size={14}/></span></div></div>
  </Link>;
}
export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const { data, loading } = useLoad(() => api('/folders?scope=explore').catch(() => ({ folders: [] })), []);
  const all = data?.folders || [];
  const folders = all.filter(f => matchesFolder(f, query));
  return <div className="home">
    <section className="home-hero">
      <div className="home-hero-copy">
        <span className="eyebrow"><Sparkles size={12}/> A SPACE FOR YOUR CURIOSITY</span>
        <h1>Learn a little.<br/>Remember a lot.</h1>
        <p>Recall turns what you read, hear, and wonder about into flashcards you actually revisit. Build collections, study with spaced repetition, and learn alongside people you trust.</p>
        <div className="home-hero-actions"><Link className="button primary" to="/signup">Start for free <ArrowRight size={17}/></Link><Link className="button secondary" to="/explore">Browse public collections</Link></div>
        <div className="home-hero-notes"><span><LockKeyhole size={13}/> Private by default</span><span><Users size={13}/> Share by username</span><span><Brain size={13}/> Smart review scheduling</span></div>
      </div>
      <HeroCard/>
    </section>
    <section className="home-steps" aria-label="How Recall works">
      {[[Layers, 'Collect', 'Create folders for anything worth remembering. Add two-sided text or image cards, tags, hints, and sources.'], [Brain, 'Recall', 'Study what is due. Rate each answer honestly and Recall brings difficult cards back sooner.'], [Users, 'Share', 'Invite collaborators as viewers or editors, publish a collection to the world, or keep it just for you.']].map(([Icon, title, text], i) => <div className="home-step" key={title}><span className="home-step-index">0{i + 1}</span><span className="home-step-icon"><Icon size={20}/></span><h3>{title}</h3><p>{text}</p></div>)}
    </section>
    <section className="home-community" id="library">
      <div className="library-section-heading"><div><span className="eyebrow">THE COMMUNITY LIBRARY</span><h2>Public collections, ready to study</h2></div><Link to="/explore" className="text-button">Explore all <ArrowRight size={15}/></Link></div>
      <form className="home-search folder-search" onSubmit={e => e.preventDefault()}><Search size={16}/><input aria-label="Search public collections" placeholder="Search public collections…" value={query} onChange={e => setParams(e.target.value ? { q: e.target.value } : {})}/></form>
      {loading ? <Loading/> : !folders.length ? query ? <Empty title="No matching collections" text="Try another word — titles, descriptions, tags, and authors are searchable without an account."/> : <div className="home-empty"><Globe2 size={22}/><p>No public collections yet. Be the first — create an account and publish a folder.</p></div> : <div className="home-folder-grid">{folders.map(f => <PublicFolderCard folder={f} key={f.id}/>)}</div>}
      <p className="home-community-note">Anyone can read and flip public cards. To save a collection, make a private copy, track progress, or create your own, you’ll need an account — it takes a few seconds.</p>
    </section>
    <section className="home-cta">
      <div><span className="banner-label"><i className="tiny-line"/> ONE CARD AT A TIME</span><h2>Your future self will thank you.</h2><p>Free to use. No credit card, no email verification, no noise.</p></div>
      <div className="home-cta-actions"><Link className="button white-button" to="/signup">Create your account</Link><Link className="text-button" to="/login">I already have one <ArrowRight size={15}/></Link></div>
    </section>
  </div>;
}
