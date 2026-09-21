import { useMemo } from 'react';
const DAY = 86400000;
const utcDay = d => { const s = new Date(d); s.setUTCHours(0, 0, 0, 0); return s; };
const key = d => d.toISOString().slice(0, 10);
/** GitHub-style contribution grid: one column per week, one cell per UTC day, shaded by review count. */
export default function Heatmap({ data = [], weeks = 26, now = new Date() }) {
  const { columns, months, max } = useMemo(() => {
    const byDate = new Map(data.map(d => [d.date, d])); const today = utcDay(now);
    const end = new Date(today.getTime() + (6 - today.getUTCDay()) * DAY); // pad to the end of the current week (Saturday)
    const start = new Date(end.getTime() - (weeks * 7 - 1) * DAY);
    const columns = []; const months = []; let max = 0;
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) { const d = new Date(start.getTime() + (w * 7 + i) * DAY); const entry = byDate.get(key(d)); const count = d > today ? null : entry?.count || 0; if (count) max = Math.max(max, count); col.push({ date: key(d), count, recalled: entry?.recalled || 0 }); }
      const first = new Date(start.getTime() + w * 7 * DAY); if (first.getUTCDate() <= 7) months.push({ index: w, label: first.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) });
      columns.push(col);
    }
    return { columns, months, max };
  }, [data, weeks, now]);
  const level = count => count == null ? 'future' : count === 0 ? 0 : Math.min(4, Math.ceil(count / Math.max(1, max) * 4));
  return <div className="heatmap" role="img" aria-label={`Study activity for the last ${weeks} weeks`}>
    <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>{months.map(m => <span key={m.index} style={{ gridColumnStart: m.index + 1 }}>{m.label}</span>)}</div>
    <div className="heatmap-body"><div className="heatmap-days"><span>Mon</span><span>Wed</span><span>Fri</span></div>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>{columns.map((col, w) => <div className="heatmap-week" key={w}>{col.map(c => <span key={c.date} className={`heatmap-cell level-${level(c.count)}`} title={c.count == null ? '' : `${c.date}: ${c.count} review${c.count === 1 ? '' : 's'}${c.count ? `, ${Math.round(c.recalled / c.count * 100)}% recalled` : ''}`}/>)}</div>)}</div></div>
    <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map(l => <span key={l} className={`heatmap-cell level-${l}`}/>)}<span>More</span></div>
  </div>;
}
