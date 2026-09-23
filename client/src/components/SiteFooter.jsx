import { Link } from 'react-router-dom';
export default function SiteFooter() {
  return <footer className="site-footer">
    {/* The inner box carries the page's own max width so the wordmark lines up with the content above it. */}
    <div className="site-footer-inner">
      <p className="site-footer-copy">
        <img src="/favicon.svg" alt=""/>
        <strong>Recall</strong>
        <span className="site-footer-tag">Learn a little. Remember a lot.</span>
      </p>
      <div className="site-footer-links">
        <nav aria-label="Site">
          <Link to="/contact">Contact</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <span className="site-footer-year">© {new Date().getFullYear()}</span>
      </div>
    </div>
  </footer>;
}
