import { Component } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { BRAND } from '../../../shared/brand.js';

/** Catches render-time crashes so a broken screen never takes the whole app down to a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[recall] render failed', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="crash-screen" role="alert">
      <span className="crash-icon"><TriangleAlert size={26}/></span>
      <h1>This screen ran into a problem.</h1>
      <p>The rest of {BRAND.name} is fine, and nothing you saved has been lost. Reloading usually clears it.</p>
      <div className="crash-actions">
        <button className="button primary" onClick={() => window.location.reload()}><RotateCcw size={16}/> Reload {BRAND.name}</button>
        <a className="button secondary" href="/">Back to my library</a>
      </div>
      <details><summary>Technical detail</summary><pre>{String(this.state.error?.stack || this.state.error)}</pre></details>
    </div>;
  }
}
