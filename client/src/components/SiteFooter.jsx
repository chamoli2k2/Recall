import { Link } from 'react-router-dom';
export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-brand"><img src="/favicon.svg" alt=""/><div><strong>Recall</strong><span>Learn a little. Remember a lot.</span></div></div>
    <nav className="site-footer-links" aria-label="Legal and contact">
      <Link to="/contact">Contact</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
    </nav>
    <p className="site-footer-note">Templates only — replace with your details when you publish.</p>
  </footer>;
}
