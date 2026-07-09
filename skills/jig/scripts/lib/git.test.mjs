import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  branchName, detectBaseCmd, prStateCmd, branchMergedCmd,
  fetchBaseCmd, checkoutFromCmd,
} from './git.mjs';

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

test('fetchBaseCmd builds a single-branch fetch from the remote', () => {
  assert.equal(fetchBaseCmd('origin', 'main'), 'git fetch origin main');
  assert.equal(fetchBaseCmd('origin', 'dev'), 'git fetch origin dev');
});

test('checkoutFromCmd creates a branch from an explicit start-point', () => {
  assert.equal(
    checkoutFromCmd('feature/add-oauth', 'origin/main'),
    'git checkout -b feature/add-oauth origin/main',
  );
  assert.equal(
    checkoutFromCmd('bug/fix-null-crash', 'main'),
    'git checkout -b bug/fix-null-crash main',
  );
});

test('fetchBaseCmd and checkoutFromCmd throw on empty args', () => {
  assert.throws(() => fetchBaseCmd('', 'main'), /requires a remote and base/);
  assert.throws(() => fetchBaseCmd('origin', ''), /requires a remote and base/);
  assert.throws(() => checkoutFromCmd('', 'main'), /requires a branch name and start-point/);
  assert.throws(() => checkoutFromCmd('feature/x', ''), /requires a branch name and start-point/);
});
