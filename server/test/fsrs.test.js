import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, preview, retrievability, intervalFor, fromLegacy, currentRetrievability, formatDays, DEFAULT_WEIGHTS } from '../src/services/fsrs.js';
const day = 86400000; const t0 = new Date('2026-01-01T00:00:00Z'); const at = days => new Date(t0.getTime() + days * day);
test('retrievability is 90% after exactly S days and the interval formula inverts it', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.equal(retrievability(0, 10), 1); assert.ok(retrievability(30, 10) < 0.8);
  assert.equal(intervalFor(10, 0.9), 10); assert.ok(intervalFor(10, 0.8) > 10, 'lower target retention → longer interval'); assert.ok(intervalFor(10, 0.95) < 10);
  assert.equal(intervalFor(0.1, 0.9), 1, 'intervals never drop below one day');
});
test('first review seeds memory from the initial-stability weights and grades order the intervals', () => {
  const first = Object.fromEntries(['again', 'hard', 'good', 'easy'].map(r => [r, schedule({}, r, t0)]));
  assert.equal(first.again.dueAt.toISOString(), '2026-01-01T00:10:00.000Z', 'a forgotten card returns after ten minutes');
  assert.equal(first.again.state, 'learning'); assert.equal(first.again.lapses, 0, 'a new card cannot lapse');
  assert.ok(first.hard.scheduledDays <= first.good.scheduledDays && first.good.scheduledDays < first.easy.scheduledDays);
  assert.equal(first.good.stability, DEFAULT_WEIGHTS[2]); assert.ok(first.easy.difficulty < first.good.difficulty && first.good.difficulty < first.again.difficulty);
  for (const r of Object.values(first)) { assert.equal(r.reps, 1); assert.ok(r.difficulty >= 1 && r.difficulty <= 10); }
});
test('successful recalls grow stability, failures shrink it and count as lapses, and target retention changes spacing', () => {
  let p = { ...schedule({}, 'good', t0), version: 1 };
  const later = schedule(p, 'good', at(p.scheduledDays)); assert.ok(later.stability > p.stability); assert.equal(later.state, 'review'); assert.equal(later.reps, 2);
  const forgot = schedule(later, 'again', at(p.scheduledDays + later.scheduledDays));
  assert.ok(forgot.stability < later.stability); assert.equal(forgot.lapses, 1); assert.equal(forgot.state, 'relearning'); assert.equal(forgot.scheduledDays, 0);
  assert.ok(schedule(later, 'easy', at(30)).scheduledDays > schedule(later, 'hard', at(30)).scheduledDays);
  const relaxed = schedule(later, 'good', at(30), { retention: 0.8 }), strict = schedule(later, 'good', at(30), { retention: 0.95 });
  assert.ok(relaxed.scheduledDays > strict.scheduledDays, 'lower desired retention spaces reviews further apart');
  // Overdue recall (reviewed well past the due date) is worth more stability than an early recall.
  assert.ok(schedule(later, 'good', at(200)).stability > schedule(later, 'good', at(5)).stability);
});
test('legacy SM-2 progress is converted so existing learners keep their spacing', () => {
  assert.equal(fromLegacy({ repetitions: 0, interval: 0 }), null);
  const memory = fromLegacy({ repetitions: 5, interval: 30, ease: 2.5 }); assert.equal(memory.stability, 30); assert.equal(memory.state, 'review'); assert.ok(memory.difficulty > 1 && memory.difficulty < 10);
  assert.ok(fromLegacy({ repetitions: 1, interval: 1, ease: 1.3 }).difficulty > fromLegacy({ repetitions: 1, interval: 1, ease: 3 }).difficulty);
  const next = schedule({ repetitions: 5, interval: 30, ease: 2.5, lastReviewedAt: at(-30) }, 'good', t0);
  assert.ok(next.scheduledDays > 30, 'a well-known legacy card keeps growing'); assert.equal(next.interval, next.scheduledDays, 'legacy interval field mirrors FSRS scheduling');
  assert.ok(Math.abs(currentRetrievability({ repetitions: 5, interval: 30, ease: 2.5, lastReviewedAt: at(-30) }, t0) - 0.9) < 1e-9);
  assert.equal(currentRetrievability({ repetitions: 0 }, t0), null);
});
test('preview labels every rating and formats intervals for humans', () => {
  const labels = preview({}, t0); assert.equal(labels.again, '10m'); assert.match(labels.good, /^\d+d$/);
  assert.equal(formatDays(1), '1d'); assert.equal(formatDays(45), '1.5mo'); assert.equal(formatDays(90), '3mo'); assert.equal(formatDays(730), '2y');
});
