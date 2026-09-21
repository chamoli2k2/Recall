import { test, expect } from '@playwright/test';
import { signUp, createFolder, createCard, share } from './helpers.js';
/** Two browsers, two accounts: presence, live updates and CRDT co-editing with visible remote cursors. */
test('collaborators see each other, receive live updates, and co-edit a card in real time', async ({ browser }) => {
  const [ownerCtx, editorCtx] = await Promise.all([browser.newContext(), browser.newContext()]);
  const owner = await ownerCtx.newPage(), editor = await editorCtx.newPage();
  const [me, them] = await Promise.all([signUp(owner, 'Owner'), signUp(editor, 'Editor')]);
  const folder = await createFolder(owner, 'Shared notes'); const card = await createCard(owner, folder.id, 'Hello', 'World');
  expect((await share(owner, folder.id, them.username, 'editor')).ok()).toBeTruthy();
  await owner.goto(`/folders/${folder.id}`); await editor.goto(`/folders/${folder.id}`);
  // Presence: each side sees the other in the "here now" stack.
  await expect(owner.locator('.presence-label')).toContainText('1 here'); await expect(editor.locator('.presence-label')).toContainText('1 here');
  // Live update: the editor adds a card over HTTP; the owner's page updates without reload and shows a toast.
  await createCard(editor, folder.id, 'Added live', 'Yes');
  await expect(owner.locator('.flashcard-item')).toHaveCount(2); await expect(owner.getByText(`${them.name} added a card`)).toBeVisible();
  // Co-editing: both open the same card; keystrokes on one side appear on the other, along with a named cursor.
  for (const page of [owner, editor]) { await page.locator('.flashcard-item', { hasText: 'Hello' }).getByRole('button', { name: /^Options for card/ }).click(); await page.getByRole('menuitem', { name: 'Edit card' }).click(); await expect(page.locator('.live-badge')).toContainText('Live'); }
  await expect(owner.locator('.live-badge')).toContainText('1 other editing');
  const ownerBack = owner.locator('.collab-text').nth(1).locator('.cm-content'), editorBack = editor.locator('.collab-text').nth(1).locator('.cm-content');
  // Remote cursors are rendered inline as widgets, so read the document text without them.
  const docText = el => el.evaluate(node => [...node.querySelectorAll('.cm-line')].map(l => [...l.childNodes].filter(n => n.nodeType === 3 || !n.classList?.contains('cm-ySelectionCaret')).map(n => n.textContent).join('')).join('\n'));
  await ownerBack.click(); await owner.keyboard.press('End'); await owner.keyboard.type(' — typed by owner');
  await expect.poll(() => docText(editorBack)).toBe('World — typed by owner');
  await expect(editor.locator('.cm-ySelectionInfo')).toContainText(me.name); // remote cursor label
  await editorBack.click(); await editor.keyboard.press('Home'); await editor.keyboard.type('Oh. ');
  await expect.poll(() => docText(ownerBack)).toBe('Oh. World — typed by owner');
  // Saving persists the merged text through the versioned HTTP API.
  await owner.getByRole('button', { name: 'Save changes' }).click(); await expect(owner.getByText('Card updated')).toBeVisible();
  const saved = await (await owner.request.get(`/api/folders/${folder.id}/cards`)).json();
  expect(saved.cards.find(c => c.id === card.id).back.text).toBe('Oh. World — typed by owner');
  // Someone editing is flagged on the folder page for everyone else.
  await expect(owner.locator('.editing-badge')).toContainText(them.name.split(' ')[0]);
  await ownerCtx.close(); await editorCtx.close();
});
test('revoking access ejects the collaborator immediately', async ({ browser }) => {
  const [ownerCtx, editorCtx] = await Promise.all([browser.newContext(), browser.newContext()]);
  const owner = await ownerCtx.newPage(), editor = await editorCtx.newPage();
  await signUp(owner, 'Owner'); const them = await signUp(editor, 'Editor');
  const folder = await createFolder(owner, 'Temporary'); await createCard(owner, folder.id, 'Q', 'A'); await share(owner, folder.id, them.username, 'viewer');
  await editor.goto(`/folders/${folder.id}`); await expect(editor.getByRole('heading', { name: 'Temporary' })).toBeVisible();
  await share(owner, folder.id, them.username, 'remove');
  await expect(editor.getByText('Your access to this folder was removed.')).toBeVisible();
  await expect(editor).toHaveURL(/\/$/);
  await ownerCtx.close(); await editorCtx.close();
});
