// Cloze deletion syntax, compatible with Anki: {{c1::answer}} or {{c1::answer::hint}}. Shared by server validation and the client.
export const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
export const hasCloze = text => { CLOZE_RE.lastIndex = 0; return CLOZE_RE.test(String(text || '')); };
export const clozeCount = text => new Set([...String(text || '').matchAll(CLOZE_RE)].map(m => m[1])).size;
/**
 * Renders cloze markers as plain text. mode 'hide' replaces each deletion with […] (or its hint), 'show' keeps the
 * answers. Markers become Unicode private-use sentinels so Markdown rendering can style them afterwards.
 */
export function renderCloze(text, mode = 'show', { open = '\uE000', close = '\uE001', hiddenOpen = '\uE002', hiddenClose = '\uE003' } = {}) {
  return String(text || '').replace(CLOZE_RE, (_m, _n, answer, hint) => mode === 'hide' ? `${hiddenOpen}${hint ? `${hint}` : '…'}${hiddenClose}` : `${open}${answer}${close}`);
}
export const stripCloze = text => String(text || '').replace(CLOZE_RE, (_m, _n, answer) => answer);
