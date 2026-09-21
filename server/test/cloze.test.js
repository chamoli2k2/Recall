import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCloze, clozeCount, renderCloze, stripCloze } from '../../shared/cloze.js';
test('cloze markers are detected, counted and rendered in hide/show modes', () => {
  const text = 'The {{c1::mitochondria}} is the {{c2::powerhouse::role}} of the cell. {{c1::Mito}} again.';
  assert.equal(hasCloze(text), true); assert.equal(hasCloze('plain text {{not a cloze}}'), false); assert.equal(hasCloze(''), false);
  assert.equal(clozeCount(text), 2);
  assert.equal(stripCloze(text), 'The mitochondria is the powerhouse of the cell. Mito again.');
  assert.equal(renderCloze(text, 'hide', { hiddenOpen: '[', hiddenClose: ']' }), 'The […] is the [role] of the cell. […] again.');
  assert.equal(renderCloze(text, 'show', { open: '<', close: '>' }), 'The <mitochondria> is the <powerhouse> of the cell. <Mito> again.');
  // Markers survive newlines and Markdown inside the answer.
  assert.equal(stripCloze('{{c1::**bold**\nline}}'), '**bold**\nline');
});
