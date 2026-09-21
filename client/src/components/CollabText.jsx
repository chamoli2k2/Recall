import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import * as Y from 'yjs';
const theme = EditorView.theme({
  '&': { fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.7', backgroundColor: 'transparent', minHeight: '170px' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7', padding: '5px 17px 15px' },
  '.cm-content': { padding: 0, caretColor: 'var(--accent)' }, '&.cm-focused': { outline: 'none' },
  '.cm-line': { padding: 0 }, '.cm-placeholder': { color: 'var(--text-4, #aa95b7)' },
  '.cm-ySelectionInfo': { fontFamily: 'inherit', fontSize: '10px', padding: '2px 5px', borderRadius: '4px', top: '-1.45em', opacity: 1 }
});
/** A plain-text CodeMirror editor bound to a shared Y.Text with remote cursors and selections. */
const CollabText = forwardRef(function CollabText({ ytext, awareness, placeholder, label, autoFocus, maxLength = 10000, onPaste }, ref) {
  const host = useRef(null), viewRef = useRef(null);
  // Same surface as the plain textarea wrapper so the editor toolbar can format either.
  useImperativeHandle(ref, () => ({
    wrap(before, after, fallback = '') {
      const view = viewRef.current; if (!view) return;
      const { from, to } = view.state.selection.main; const selected = view.state.sliceDoc(from, to) || fallback;
      view.dispatch({ changes: { from, to, insert: before + selected + after }, selection: { anchor: from + before.length, head: from + before.length + selected.length }, userEvent: 'input' }); view.focus();
    },
    selection() { const view = viewRef.current; if (!view) return ''; const { from, to } = view.state.selection.main; return view.state.sliceDoc(from, to); }
  }), []);
  useEffect(() => {
    if (!host.current || !ytext) return;
    const undo = new Y.UndoManager(ytext);
    const limit = EditorState.changeFilter.of(tr => tr.newDoc.length <= maxLength);
    const state = EditorState.create({ doc: ytext.toString(), extensions: [theme, EditorView.lineWrapping, placeholderExt(placeholder || ''), limit, keymap.of([...yUndoManagerKeymap, ...defaultKeymap]), yCollab(ytext, awareness, { undoManager: undo }), EditorView.contentAttributes.of({ 'aria-label': label || 'text', spellcheck: 'true' })] });
    const view = new EditorView({ state, parent: host.current }); viewRef.current = view; if (autoFocus) view.focus();
    return () => { view.destroy(); undo.destroy(); viewRef.current = null; };
  }, [ytext, awareness]);
  return <div className="collab-text" ref={host} onPaste={onPaste}/>;
});
export default CollabText;
/** Plain textarea with the same wrap()/selection() surface as CollabText, used for new (not yet shared) cards. */
export const PlainText = forwardRef(function PlainText({ value, onChange, ...rest }, ref) {
  const el = useRef(null);
  useImperativeHandle(ref, () => ({
    wrap(before, after, fallback = '') {
      const t = el.current; if (!t) return; const { selectionStart: from, selectionEnd: to } = t; const selected = t.value.slice(from, to) || fallback;
      onChange(t.value.slice(0, from) + before + selected + after + t.value.slice(to));
      requestAnimationFrame(() => { t.focus(); t.setSelectionRange(from + before.length, from + before.length + selected.length); });
    },
    selection() { const t = el.current; return t ? t.value.slice(t.selectionStart, t.selectionEnd) : ''; }
  }), [onChange]);
  return <textarea ref={el} value={value} onChange={e => onChange(e.target.value)} {...rest}/>;
});
