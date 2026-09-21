import { useEffect, useRef } from 'react';
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
export default function CollabText({ ytext, awareness, placeholder, label, autoFocus, maxLength = 10000, onPaste }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !ytext) return;
    const undo = new Y.UndoManager(ytext);
    const limit = EditorState.changeFilter.of(tr => tr.newDoc.length <= maxLength);
    const state = EditorState.create({ doc: ytext.toString(), extensions: [theme, EditorView.lineWrapping, placeholderExt(placeholder || ''), limit, keymap.of([...yUndoManagerKeymap, ...defaultKeymap]), yCollab(ytext, awareness, { undoManager: undo }), EditorView.contentAttributes.of({ 'aria-label': label || 'text', spellcheck: 'true' })] });
    const view = new EditorView({ state, parent: host.current }); if (autoFocus) view.focus();
    return () => { view.destroy(); undo.destroy(); };
  }, [ytext, awareness]);
  return <div className="collab-text" ref={host} onPaste={onPaste}/>;
}
