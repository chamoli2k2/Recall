/** Future AI/RAG port. Keep retrieval separate from card CRUD and always enforce
 * folder access at query time. No model client, embeddings, or external calls ship.
 * An indexer can consume DomainEvent after commit; do not put card content in events.
 */
export class KnowledgeProvider {
  async indexFolder(_folderId) { throw new Error('Knowledge indexing is not enabled'); }
  async removeFolder(_folderId) { throw new Error('Knowledge indexing is not enabled'); }
  async retrieve(_query, _authorizedFolderIds) { throw new Error('Knowledge retrieval is not enabled'); }
}
export const capabilities = Object.freeze({ aiGeneration: false, retrieval: false });
