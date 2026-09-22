import { Link } from 'react-router-dom';
export default function SiteFooter() {
  return <footer className="site-footer">
    <p className="site-footer-copy"><img src="/favicon.svg" alt=""/> Recall <span>· Learn a little. Remember a lot.</span></p>
    <nav aria-label="Site">
      <Link to="/contact">Contact</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
    </nav>
  </footer>;
}
