import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RotateCcw, Layers, Users, Brain, Globe2, LockKeyhole, Sparkles, Search, ChevronDown } from 'lucide-react';
import { api, imageUrl } from '../services/api';
import { useQuery } from '../hooks/useApp';
import { FolderIcon, Loading, Avatar, Empty } from '../components/ui';
import { BRAND } from '../../../shared/brand.js';
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
const FAQS = [
  [`Is ${BRAND.name} actually free?`,
    'Yes, and the free tier is the whole product rather than a teaser. Accounts, collections, cards, spaced repetition, publishing to the community, and your own progress all cost nothing, and we never ask for a card. Premium adds projects, deck import and export, folder covers, live quiz hosting, and editor invites.'],
  [`How does ${BRAND.name} decide what to show me each day?`,
    'It runs on FSRS, the scheduler behind modern Anki. Rate each answer honestly and it works out when you are about to forget that particular card, then brings it back just before you do. Hard cards return in a day or two, ones you know well drift out to weeks or months. Most people need a few minutes a day.'],
  ['What happens if I miss a few days?',
    'Nothing breaks and nothing is lost. There is no streak to protect, so there is nothing to feel bad about. Your due cards wait, and when you come back the schedule works from what you actually remember rather than what you meant to do.'],
  ['Can I study with friends, or run a class?',
    'Both. Share any folder by username, as a viewer or, on Premium, as an editor who can work on it with you live. Classrooms go further: buy seats, invite people with a code or link, set assignments with due dates, and read a coverage and accuracy report for the group.'],
  ['Who can see what I make?',
    'Only you, until you say otherwise. New collections are private. You can share one with named people, or publish it for anyone to read and copy. Even in a classroom, teachers only see progress on the classroom’s own material, never your personal library.'],
  ['Will I ever be charged automatically?',
    'No. There is no auto-renewal and we hold no mandate against your card or UPI ID. Each plan is one payment for a fixed period. When it runs out your account drops back to the free tier and every card you made stays exactly where it is. Changed your mind? Personal plans refund in full for 7 days.'],
  ['Can I bring in decks I already have, and get them out again?',
    'Yes, both ways. Premium accounts import from Anki, CSV, Markdown, or JSON, and export any folder back out as JSON or CSV whenever they like. Your cards are never locked in.'],
  ['Does it work on my phone?',
    `Yes. ${BRAND.name} runs in any modern browser and the layout adapts to phones and tablets, so you can review on the bus and write cards properly on a laptop later. It is one library either way.`],
];
function Faq() {
  return <section className="home-faq" id="faq">
    <div className="home-faq-head">
      <span className="eyebrow">GOOD QUESTIONS</span>
      <h2>The things people ask before they start</h2>
      <p>Short answers, honestly given. If yours is not here, we would like to hear it.</p>
      <p className="home-faq-foot">Something we did not cover? <Link to="/contact">Ask us directly</Link>, and a person will read it.</p>
    </div>
    <div className="faq-list">
      {FAQS.map(([question, answer]) => <details className="faq-item" key={question}>
        <summary>{question}<ChevronDown className="faq-chevron" size={18}/></summary>
        <div className="faq-answer"><p>{answer}</p></div>
      </details>)}
    </div>
  </section>;
}
function PublicFolderCard({ folder }) {
  return <Link className={`home-folder ${folder.color}`} to={`/folders/${folder.id}`}>
    <div className="home-folder-cover">{folder.thumbnail ? <img className="tile-thumb" src={imageUrl(folder.thumbnail)} alt=""/> : <span className="folder-icon"><FolderIcon name={folder.icon} size={26}/></span>}<span className="visibility-badge"><Globe2 size={11}/> Public</span></div>
    <div className="home-folder-body"><h3>{folder.title}</h3><p>{folder.description || 'A public collection of flashcards.'}</p>
      <div className="home-folder-meta"><span><Avatar user={folder.owner} small/> @{folder.owner?.username}</span><span>{folder.cardCount} cards · {folder.likeCount || 0} likes · {folder.copyCount || 0} copies</span></div></div>
  </Link>;
}
/** Three full rows of the grid. The rest of the library lives behind Explore. */
const HOME_FOLDERS = 9;

export default function HomePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const { data, loading } = useQuery('/folders?scope=explore', () => api('/folders?scope=explore').catch(() => ({ folders: [] })));
  const { data: people } = useQuery(`/users?q=${encodeURIComponent(query.trim())}`, undefined, { enabled: query.trim().length >= 2 });
  const all = data?.folders || [];
  const folders = all.filter(f => matchesFolder(f, query));
  // A search is left whole. Hiding something somebody asked for by name reads as a missing result
  // rather than a shortened list.
  const visible = query ? folders : folders.slice(0, HOME_FOLDERS);
  return <div className="home">
    <section className="home-hero">
      <div className="home-hero-copy">
        <span className="eyebrow"><Sparkles size={12}/> A SPACE FOR YOUR CURIOSITY</span>
        <h1>Learn a little.<br/>Remember a lot.</h1>
        <p>{BRAND.name} turns what you read, hear, and wonder about into flashcards you actually revisit. Build collections, study with spaced repetition, and learn alongside people you trust.</p>
        <div className="home-hero-actions"><Link className="button primary" to="/signup">Start for free <ArrowRight size={17}/></Link><Link className="button secondary" to="/explore">Browse public collections</Link></div>
        <div className="home-hero-notes"><span><LockKeyhole size={13}/> Private by default</span><span><Users size={13}/> Share by username</span><span><Brain size={13}/> Smart review scheduling</span></div>
      </div>
      <HeroCard/>
    </section>
    <section className="home-steps" aria-label={`How ${BRAND.name} works`}>
      {[[Layers, 'Collect', 'Create folders for anything worth remembering. Add two-sided text or image cards, tags, hints, and sources.'], [Brain, 'Recall', `Study what is due. Rate each answer honestly and ${BRAND.name} brings difficult cards back sooner.`], [Users, 'Share', 'Invite collaborators as viewers or editors, publish a collection to the world, or keep it just for you.']].map(([Icon, title, text], i) => <div className="home-step" key={title}><span className="home-step-index">0{i + 1}</span><span className="home-step-icon"><Icon size={20}/></span><h3>{title}</h3><p>{text}</p></div>)}
    </section>
    <section className="home-community" id="library">
      <div className="library-section-heading"><div><span className="eyebrow">THE COMMUNITY LIBRARY</span><h2>Public collections, ready to study</h2></div><Link to="/explore" className="text-button">Explore all <ArrowRight size={15}/></Link></div>
      <form className="home-search folder-search" onSubmit={e => e.preventDefault()}><Search size={16}/><input aria-label="Search public collections and people" placeholder="Search collections or people…" value={query} onChange={e => setParams(e.target.value ? { q: e.target.value } : {})}/></form>
      {people?.users?.length > 0 && <div className="people-hits">{people.users.map(p => <Link key={p.id} className="person-chip" to={`/u/${p.username}`}><Avatar user={p} small/> {p.name} <small>@{p.username}</small></Link>)}</div>}
      {loading ? <Loading/> : !folders.length ? query ? <Empty title="No matching collections" text="Try another word. Titles, descriptions, tags, and authors are all searchable without an account."/> : <div className="home-empty"><Globe2 size={22}/><p>No public collections yet. Be the first: create an account and publish a folder.</p></div> : <div className="home-folder-grid">{visible.map(f => <PublicFolderCard folder={f} key={f.id}/>)}</div>}
      {folders.length > visible.length && <div className="home-folder-more"><Link className="button secondary" to="/explore">Explore more collections <ArrowRight size={16}/></Link></div>}
      <p className="home-community-note">Anyone can read and flip public cards. To save a collection, make a private copy, track progress, or create your own, you’ll need an account, which takes a few seconds.</p>
    </section>
    <Faq/>
    <section className="home-cta">
      <div><span className="banner-label"><i className="tiny-line"/> ONE CARD AT A TIME</span><h2>Your future self will thank you.</h2><p>Free to use. No credit card, no email verification, no noise.</p></div>
      <div className="home-cta-actions"><Link className="button white-button" to="/signup">Create your account</Link><Link className="text-button" to="/login">I already have one <ArrowRight size={15}/></Link></div>
    </section>
  </div>;
}
