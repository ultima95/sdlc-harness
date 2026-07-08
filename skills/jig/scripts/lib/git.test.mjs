import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchName, detectBaseCmd, prStateCmd, branchMergedCmd } from './git.mjs';

test('branchName joins type and slug as <type>/<slug>', () => {
  assert.equal(branchName('feature', 'add-oauth-login'), 'feature/add-oauth-login');
  assert.equal(branchName('bug', 'fix-null-crash'), 'bug/fix-null-crash');
});

test('branchName normalizes messy input via slugify', () => {
  assert.equal(branchName('Feature', 'Add OAuth Login'), 'feature/add-oauth-login');
});

test('branchName throws when a part is empty', () => {
  assert.throws(() => branchName('', 'x'), /requires a type and slug/);
  assert.throws(() => branchName('feature', ''), /requires a type and slug/);
});

test('command builders produce the exact git/gh invocations', () => {
  assert.equal(detectBaseCmd(), 'git symbolic-ref --short refs/remotes/origin/HEAD');
  assert.equal(prStateCmd('42'), 'gh pr view 42 --json state,mergedAt');
  assert.equal(branchMergedCmd('feature/x', 'main'), 'git merge-base --is-ancestor feature/x main');
});
