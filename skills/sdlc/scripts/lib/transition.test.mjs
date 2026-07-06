import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, nextPhase } from './transition.mjs';

test('PHASES is the canonical ordered lifecycle', () => {
  assert.deepEqual(PHASES, ['intake', 'spec_plan', 'implement', 'test', 'review', 'ship', 'done']);
});

test('nextPhase returns the following phase', () => {
  assert.equal(nextPhase('intake'), 'spec_plan');
  assert.equal(nextPhase('spec_plan'), 'implement');
  assert.equal(nextPhase('review'), 'ship');
});

test('nextPhase caps at done', () => {
  assert.equal(nextPhase('ship'), 'done');
  assert.equal(nextPhase('done'), 'done');
});

test('nextPhase throws on an unknown phase', () => {
  assert.throws(() => nextPhase('bogus'), /unknown phase/);
});
