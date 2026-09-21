import * as Y from 'yjs';
// Server-side Yjs documents for cards under live co-editing. One Y.Doc per open card, reference counted by connected
// editors, persisted (debounced) to CardDoc and evicted when the last editor leaves. The Card document stays the
// authoritative, versioned text: clients write the merged text back through the normal PATCH /cards/:id path.
export class DocStore {
  constructor({ load, save, debounceMs = 1500 } = {}) { this.load = load; this.save = save; this.debounceMs = debounceMs; this.docs = new Map(); }
  static seed(doc, card) { doc.getText('front').insert(0, card.front?.text || ''); doc.getText('back').insert(0, card.back?.text || ''); }
  async acquire(cardId, card) {
    let entry = this.docs.get(cardId);
    if (!entry) {
      const doc = new Y.Doc(); const persisted = await this.load?.(cardId);
      // Use the persisted CRDT state only if it is at least as new as the card; otherwise reseed from the authoritative text.
      if (persisted?.state && (!card?.updatedAt || persisted.updatedAt >= card.updatedAt)) Y.applyUpdate(doc, new Uint8Array(persisted.state)); else DocStore.seed(doc, card || {});
      entry = { doc, refs: 0, dirty: false, timer: null }; this.docs.set(cardId, entry);
    }
    entry.refs++; return entry.doc;
  }
  apply(cardId, update) {
    const entry = this.docs.get(cardId); if (!entry) return false;
    Y.applyUpdate(entry.doc, new Uint8Array(update)); entry.dirty = true;
    clearTimeout(entry.timer); entry.timer = setTimeout(() => this.persist(cardId), this.debounceMs); return true;
  }
  async persist(cardId) { const entry = this.docs.get(cardId); if (!entry?.dirty) return; entry.dirty = false; try { await this.save?.(cardId, Buffer.from(Y.encodeStateAsUpdate(entry.doc))); } catch (e) { console.error('CardDoc persist failed', e.message); } }
  async release(cardId) {
    const entry = this.docs.get(cardId); if (!entry) return; entry.refs--;
    if (entry.refs <= 0) { clearTimeout(entry.timer); await this.persist(cardId); entry.doc.destroy(); this.docs.delete(cardId); }
  }
  state(cardId) { const entry = this.docs.get(cardId); return entry ? Y.encodeStateAsUpdate(entry.doc) : null; }
  text(cardId, field) { return this.docs.get(cardId)?.doc.getText(field).toString(); }
}
