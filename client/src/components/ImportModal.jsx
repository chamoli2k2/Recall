import { useState } from 'react';
import { Upload, FileText, Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Button, ErrorState, Field } from './ui';
import { api } from '../services/api';
import { useApp } from '../hooks/useApp';
const FORMAT_NAMES = { apkg: 'Anki deck (.apkg)', 'anki-text': 'Anki plain-text export', csv: 'CSV / TSV', markdown: 'Markdown', json: 'Recall JSON' };
/** Two-step import: upload for a dry-run preview, then confirm to insert the cards in one transaction. */
export default function ImportModal({ folder, onClose }) {
  const { refresh } = useApp(); const [file, setFile] = useState(null), [preview, setPreview] = useState(null), [tags, setTags] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function analyse(f) {
    if (!f) return; setFile(f); setPreview(null); setError(''); setBusy(true);
    try { const data = new FormData(); data.append('file', f); setPreview(await api(`/folders/${folder.id}/import?dryRun=1`, { method: 'POST', body: data })); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setError('');
    try { const data = new FormData(); data.append('file', file); data.append('tags', tags); const r = await api(`/folders/${folder.id}/import`, { method: 'POST', body: data }); refresh(); toast.success(`${r.imported} card${r.imported === 1 ? '' : 's'} imported`); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <Modal open onClose={onClose} title="Bring your cards along" description={`Import into ${folder.title} from Anki, a spreadsheet, Markdown notes, or a Recall export.`}>
    <div className="form-stack">
      <label className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); analyse(e.dataTransfer.files[0]); }}>
        <input type="file" accept=".apkg,.colpkg,.txt,.csv,.tsv,.md,.markdown,.json,text/csv,text/plain,text/markdown,application/json" onChange={e => analyse(e.target.files[0])}/>
        <span className="dropzone-icon">{file ? <FileText size={22}/> : <Upload size={22}/>}</span>
        <strong>{file ? file.name : 'Drop a file here or click to choose'}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(file.size > 102400 ? 0 : 1)} KB` : '.apkg · Anki .txt · .csv / .tsv · .md · .json'}</small>
      </label>
      <div className="import-templates"><span><Download size={14}/> Download a sample file</span><a href="/import-templates/dummy.json" download="dummy.json">dummy.json</a><a href="/import-templates/dummy.csv" download="dummy.csv">dummy.csv</a><a href="/import-templates/dummy.md" download="dummy.md">dummy.md</a><a href="/import-templates/dummy.txt" download="dummy.txt">dummy.txt</a></div>
      <details className="import-help"><summary>Which formats work?</summary><ul>
        <li><strong>JSON</strong> — download <a href="/import-templates/dummy.json" download="dummy.json">dummy.json</a>. An object with a <code>cards</code> array (or a bare array). Each card has <code>front</code>/<code>back</code> as <code>{`{ "text": "…" }`}</code> or a string, plus optional <code>tags</code>, <code>hint</code>, and <code>source</code>.</li>
        <li><strong>CSV / TSV</strong> — download <a href="/import-templates/dummy.csv" download="dummy.csv">dummy.csv</a>. Header row <code>front,back,tags,hint,source</code> (names can be aliases such as question/answer). Quotes and multi-line cells are fine. Without a header, columns are positional: front, back, tags, hint, source.</li>
        <li><strong>Markdown</strong> — download <a href="/import-templates/dummy.md" download="dummy.md">dummy.md</a>. <code>Q:</code>/<code>A:</code> blocks, <code>## Question</code> headings with the answer below, <code>term :: definition</code> lines, or two-column tables. <code>#hashtags</code> and a <code>tags:</code> line become tags.</li>
        <li><strong>Anki</strong> — download <a href="/import-templates/dummy.txt" download="dummy.txt">dummy.txt</a> for the plain-text export, or use File → Export → Anki Deck Package (.apkg) with <em>Support older Anki versions</em> checked. Text is imported; images and audio are not.</li>
      </ul></details>
      {busy && !preview && <p className="import-status">Reading your file…</p>}
      {preview && <div className="import-preview">
        <div className="import-summary"><Check size={16}/> Found <strong>{preview.total}</strong> card{preview.total === 1 ? '' : 's'} ({FORMAT_NAMES[preview.format] || preview.format}){preview.skipped ? <span> · {preview.skipped} skipped for missing text</span> : null}{preview.truncated && <span> · only the first 2000 will be imported</span>}</div>
        <ul>{preview.sample.map((c, i) => <li key={i}><span>{c.front.text}</span><span>{c.back.text}</span></li>)}</ul>
        <Field label="Add a tag to every imported card · optional"><input placeholder="e.g. imported, chapter-3" value={tags} maxLength={80} onChange={e => setTags(e.target.value)}/></Field>
      </div>}
      {error && <ErrorState message={error}/>}
      <div className="modal-actions"><Button type="button" className="secondary" onClick={onClose}>Cancel</Button><Button type="button" className="primary" disabled={!preview} loading={busy && !!preview} onClick={commit}><Upload size={16}/> Import {preview ? Math.min(preview.total, 2000) : ''} cards</Button></div>
    </div>
  </Modal>;
}
