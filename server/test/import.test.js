import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseCsv, parseDelimited, parseMarkdown, parseAnkiText, parseJson, parseApkg, parseFile, stripHtml, toCsv, detectFormat } from '../src/services/importService.js';
test('CSV: header row in any order, positional columns, quoted fields with commas and newlines, TSV auto-detection', () => {
  const withHeader = parseCsv('Answer,Tags,Question\n"Paris, France",geo europe,Capital of France?\nBerlin,geo,Capital of Germany?');
  assert.deepEqual(withHeader.map(c => [c.front.text, c.back.text, c.tags]), [['Capital of France?', 'Paris, France', ['geo', 'europe']], ['Capital of Germany?', 'Berlin', ['geo']]]);
  const positional = parseCsv('What is 2+2?,"4\nfour",math\n,missing front\nno back');
  assert.equal(positional.length, 1); assert.equal(positional[0].back.text, '4\nfour'); assert.deepEqual(positional[0].tags, ['math']);
  assert.deepEqual(parseDelimited('a\tb\nc\td'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseDelimited('"say ""hi""",x'), [['say "hi"', 'x']]);
});
test('Markdown: Q/A blocks, headings, term :: definition lines and tables, with tags from hashtags or tags: lines', () => {
  const qa = parseMarkdown('Q: What is a closure?\nA: A function with its lexical scope. #javascript #functions\n\nQ: Two\nlines?\nA: Yes.\ntags: misc');
  assert.equal(qa.length, 2); assert.equal(qa[0].back.text, 'A function with its lexical scope.'); assert.deepEqual(qa[0].tags, ['javascript', 'functions']); assert.equal(qa[1].front.text, 'Two\nlines?'); assert.deepEqual(qa[1].tags, ['misc']);
  const headings = parseMarkdown('# ACID\nAtomicity, consistency, isolation, durability.\n\n## Idempotency\nSame effect when repeated.');
  assert.deepEqual(headings.map(c => c.front.text), ['ACID', 'Idempotency']);
  const terms = parseMarkdown('- hola :: hello\n* adiós :: goodbye #spanish\ngracias :: thank you');
  assert.deepEqual(terms.map(c => [c.front.text, c.back.text]), [['hola', 'hello'], ['adiós', 'goodbye'], ['gracias', 'thank you']]); assert.deepEqual(terms[1].tags, ['spanish']);
  const table = parseMarkdown('| Front | Back | Tags |\n|---|---|---|\n| HTTP 201 | Created | http |\n| HTTP 404 | Not found | http |');
  assert.equal(table.length, 2); assert.deepEqual(table[0].tags, ['http']);
});
test('Anki plain-text export: metadata header, HTML fields, guid/notetype/deck columns skipped, tags column honoured', () => {
  const text = '#separator:tab\n#html:true\n#guid column:1\n#notetype column:2\n#deck column:3\n#tags column:6\nabc123\tBasic\tDefault\t<b>What</b> is <i>DNS</i>?&nbsp;\tName &rarr; address<br>lookup [sound:x.mp3]<img src="a.png">\tnetworking dns\n';
  const cards = parseAnkiText(text); assert.equal(cards.length, 1);
  assert.equal(cards[0].front.text, 'What is DNS?'); assert.equal(cards[0].back.text, 'Name &rarr; address\nlookup'); assert.deepEqual(cards[0].tags, ['networking', 'dns']);
  assert.equal(stripHtml('<div>a</div><div>b</div><ul><li>c</li></ul>'), 'a\nb\n• c');
});
test('Anki .apkg: SQLite collection inside a zip; fields split on 0x1f; newest zstd format gets a clear message', async () => {
  const SQL = await import('sql.js').then(m => m.default({ locateFile: f => new URL(`../../node_modules/sql.js/dist/${f}`, import.meta.url).pathname }));
  const db = new SQL.Database(); db.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT, tags TEXT)');
  db.run('INSERT INTO notes VALUES (1, ?, ?)', ['<p>Capital of Japan?</p>\x1fTokyo', ' geography asia ']); db.run('INSERT INTO notes VALUES (2, ?, ?)', ['Only front\x1f', '']);
  const apkg = zipSync({ 'collection.anki2': db.export(), media: strToU8('{}') }); db.close();
  const cards = await parseApkg(Buffer.from(apkg)); assert.equal(cards.length, 1); assert.equal(cards[0].front.text, 'Capital of Japan?'); assert.equal(cards[0].back.text, 'Tokyo'); assert.deepEqual(cards[0].tags, ['geography', 'asia']);
  await assert.rejects(parseApkg(Buffer.from(zipSync({ 'collection.anki21b': strToU8('zstd') }))), /Support older Anki versions/);
  await assert.rejects(parseApkg(Buffer.from('not a zip')), /not a valid \.apkg/);
});
test('JSON round-trip through export and detection of formats by name and content', async () => {
  const cards = parseJson(JSON.stringify({ cards: [{ front: { text: 'F' }, back: { text: 'B' }, tags: ['t'], hint: 'h', source: 'https://example.com' }, { front: 'plain', back: 'strings' }] }));
  assert.equal(cards.length, 2); assert.equal(cards[0].source, 'https://example.com'); assert.equal(cards[1].back.text, 'strings');
  const csv = toCsv(cards); assert.ok(csv.startsWith('front,back,tags,hint,source')); assert.deepEqual(parseCsv(csv).map(c => c.front.text), ['F', 'plain']);
  assert.equal(detectFormat('deck.apkg'), 'apkg'); assert.equal(detectFormat('notes.md'), 'markdown'); assert.equal(detectFormat('x.tsv'), 'csv'); assert.equal(detectFormat('x', 'application/json'), 'json');
  assert.equal((await parseFile(Buffer.from('#separator:tab\n#html:false\na\tb\n'), 'export.txt', 'text/plain')).format, 'anki-text');
  assert.equal((await parseFile(Buffer.from('a,b\n'), 'plain.txt', 'text/plain')).format, 'csv');
});
