import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore, buildQuestions, scoreFor, SCORE } from '../src/realtime/rooms.js';
const cards = [
  { id: 'c1', front: { text: 'Capital of France?' }, back: { text: 'Paris' } },
  { id: 'c2', front: { text: 'Capital of Germany?' }, back: { text: 'Berlin' } },
  { id: 'c3', front: { text: 'Capital of Italy?' }, back: { text: 'Rome' } },
  { id: 'c4', front: { text: 'The {{c1::heart}} pumps blood.' }, back: { text: '' } }, // cloze: answer comes from the front
  { id: 'c5', front: { text: '' }, back: { text: 'orphan' } } // unusable: no prompt
];
// Deterministic clock and scheduler so timing is asserted, not slept through.
function harness() {
  let t = 1_000_000; const timers = [];
  const store = new RoomStore({ now: () => t, rand: () => 0.42, schedule: (fn, ms) => { const h = { fn, at: t + ms }; timers.push(h); return h; }, cancel: h => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); } });
  return { store, tick: ms => { t += ms; for (const h of [...timers]) if (h.at <= t) { timers.splice(timers.indexOf(h), 1); h.fn(); } }, timers };
}
test('questions get one correct option plus distinct distractors; cloze cards use the blanked front as the prompt', () => {
  const qs = buildQuestions(cards, { rand: () => 0.42 });
  assert.equal(qs.length, 4, 'the card without a prompt is skipped');
  for (const q of qs) { assert.ok(q.options.length >= 2 && q.options.length <= 4); assert.equal(new Set(q.options).size, q.options.length); assert.ok(q.correct >= 0); }
  const cloze = qs.find(q => q.cardId === 'c4'); assert.equal(cloze.prompt, 'The […] pumps blood.'); assert.equal(cloze.options[cloze.correct], 'heart');
  assert.equal(buildQuestions(cards, { count: 2 }).length, 2);
});
test('scoring rewards speed with a floor and adds a capped streak bonus', () => {
  assert.equal(scoreFor(0, 20000, 1), SCORE.base);
  assert.equal(scoreFor(20000, 20000, 1), SCORE.base * SCORE.floor);
  assert.equal(scoreFor(10000, 20000, 1), 750);
  assert.equal(scoreFor(0, 20000, 3) - scoreFor(0, 20000, 1), 2 * SCORE.streakBonus);
  assert.equal(scoreFor(0, 20000, 50) - scoreFor(0, 20000, 1), SCORE.streakCap);
});
test('a room runs lobby -> question -> reveal -> ... -> finished, only the host advances, and answers score once', () => {
  const { store, tick, timers } = harness(); const changes = []; store.onChange(r => changes.push(r.phase));
  const host = { id: 'u1', name: 'Host' }, guest = { id: 'u2', name: 'Guest' };
  const room = store.create({ folder: { id: 'f1', title: 'Capitals' }, host, cards, count: 2, seconds: 10 });
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{6}$/); assert.equal(room.phase, 'lobby'); assert.equal(room.questions.length, 2);
  store.join(room.code, guest); assert.equal(store.snapshot(room.code).players.length, 2);
  assert.throws(() => store.start(room.code, guest.id), /Only the host/);
  store.start(room.code, host.id); let snap = store.snapshot(room.code, guest.id);
  assert.equal(snap.phase, 'question'); assert.equal(snap.index, 0); assert.equal(snap.question.correct, null, 'correct option is hidden while open'); assert.equal(snap.deadline, 1_000_000 + 10_000); assert.equal(timers.length, 1);
  const correct = store.get(room.code).questions[0].correct;
  tick(2000); store.answer(room.code, guest.id, correct); store.answer(room.code, guest.id, correct); // second answer ignored
  snap = store.snapshot(room.code, guest.id); assert.equal(snap.answeredCount, 1); assert.equal(snap.myAnswer.choice, correct); assert.equal(snap.myAnswer.correct, null);
  tick(8000); // the clock runs out: auto-reveal
  snap = store.snapshot(room.code, guest.id); assert.equal(snap.phase, 'reveal'); assert.equal(snap.question.correct, correct); assert.equal(snap.myAnswer.correct, true); assert.equal(snap.myAnswer.points, scoreFor(2000, 10000, 1));
  assert.equal(snap.players[0].id, guest.id); assert.equal(snap.players[0].score, 900); assert.equal(snap.players[1].streak, 0, 'a missed question breaks the host streak');
  store.next(room.code, host.id); assert.equal(store.get(room.code).phase, 'question');
  const wrong = (store.get(room.code).questions[1].correct + 1) % store.get(room.code).questions[1].options.length;
  store.answer(room.code, host.id, wrong); assert.equal(store.get(room.code).phase, 'question', 'waits for the other player');
  store.answer(room.code, guest.id, store.get(room.code).questions[1].correct); assert.equal(store.get(room.code).phase, 'reveal', 'everyone answered: early reveal'); assert.equal(timers.length, 0, 'timer cancelled');
  assert.equal(store.snapshot(room.code).players.find(p => p.id === guest.id).streak, 2);
  store.next(room.code, host.id); assert.equal(store.get(room.code).phase, 'finished'); assert.equal(store.snapshot(room.code).question, null);
  assert.deepEqual(changes.filter((p, i) => changes[i - 1] !== p), ['lobby', 'lobby', 'question', 'question', 'reveal', 'question', 'question', 'reveal', 'finished'].filter((p, i, a) => a[i - 1] !== p));
});
test('leaving: lobby leavers vanish, mid-game leavers stay on the board, the host hands over, and the last player closes the room', () => {
  const { store } = harness(); const host = { id: 'u1', name: 'Host' }, a = { id: 'u2', name: 'A' }, b = { id: 'u3', name: 'B' };
  const room = store.create({ folder: { id: 'f1', title: 'T' }, host, cards, count: 2, seconds: 10 });
  store.join(room.code, a); store.join(room.code, a); store.join(room.code, b); // A has two tabs
  store.leave(room.code, b.id); assert.equal(store.snapshot(room.code).players.length, 2, 'lobby leaver removed');
  store.start(room.code, host.id); store.leave(room.code, a.id); assert.equal(store.snapshot(room.code).players.find(p => p.id === a.id).connected, true, 'still one tab open');
  store.leave(room.code, host.id); const snap = store.snapshot(room.code); assert.equal(snap.hostId, a.id, 'host handed to a connected player'); assert.equal(snap.players.find(p => p.id === host.id).connected, false, 'kept on the leaderboard mid-game');
  assert.equal(store.leave(room.code, a.id), null); assert.equal(store.get(room.code), undefined, 'room destroyed with its timer');
  assert.throws(() => store.join('ZZZZZZ', a), /Room not found/);
  assert.throws(() => store.create({ folder: { id: 'f1', title: 'T' }, host, cards: cards.slice(0, 1) }), /at least two cards/);
});
