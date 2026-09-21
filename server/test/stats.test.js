import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks } from '../src/services/statsService.js';
const now = new Date('2026-09-21T20:00:00Z');
test('streaks count consecutive UTC study days and survive until the end of a day without a review', () => {
  assert.deepEqual(computeStreaks(new Set(), now), { current: 0, longest: 0 });
  assert.deepEqual(computeStreaks(new Set(['2026-09-19', '2026-09-20', '2026-09-21']), now), { current: 3, longest: 3 });
  assert.deepEqual(computeStreaks(new Set(['2026-09-19', '2026-09-20']), now), { current: 2, longest: 2 }, 'no review yet today keeps yesterday’s streak alive');
  assert.deepEqual(computeStreaks(new Set(['2026-09-18', '2026-09-19']), now), { current: 0, longest: 2 }, 'a missed day ends the streak');
  assert.deepEqual(computeStreaks(new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-10', '2026-09-21']), now), { current: 1, longest: 4 });
  assert.deepEqual(computeStreaks(new Set(['2026-08-31', '2026-09-01']), new Date('2026-09-01T00:00:00Z')), { current: 2, longest: 2 }, 'month boundaries are ordinary days');
});
