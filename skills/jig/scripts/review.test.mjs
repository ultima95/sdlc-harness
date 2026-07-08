import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { dedupeFindings, verdict, renderReview, writeReview } from './review.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jig-rev-'));
  tmps.push(root);
  scaffoldJig(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

const F = (o) => ({ dimension: 'correctness', file: 'a.js', line: 1, severity: 'high', claim: 'x', ...o });

test('dedupeFindings merges arrays and dedupes by dimension+file+line+claim', () => {
  const out = dedupeFindings([[F({}), F({})], [F({ line: 2 }), F({ claim: 'y' })]]);
  assert.equal(out.length, 3); // the exact duplicate is removed
});

test('verdict applies the adversarial majority rule', () => {
  assert.equal(verdict([{ refuted: true }, { refuted: true }, { refuted: false }]), 'refuted');
  assert.equal(verdict([{ refuted: true }, { refuted: false }, { refuted: false }]), 'real');
  assert.equal(verdict([{ refuted: true }]), 'refuted');
  assert.equal(verdict([{ refuted: false }]), 'real');
  assert.equal(verdict([]), 'real'); // no verifiers -> keep the finding
});

test('renderReview renders a table, or a none-row when empty', () => {
  assert.match(renderReview([]), /_none_/);
  const t = renderReview([F({ verdict: 'real' })]);
  assert.match(t, /\| dimension \| location \|/);
  assert.match(t, /a\.js:1/);
  assert.match(t, /correctness/);
});

test('writeReview writes review.md under the task with the task id header', () => {
  const taskDir = newTask();
  const n = writeReview(taskDir, [F({ verdict: 'real' }), F({ verdict: 'real' })]);
  assert.equal(n, 1); // deduped to one
  const md = fs.readFileSync(path.join(taskDir, 'review.md'), 'utf8');
  assert.match(md, /# Review — 20260706\/fix-login/);
  assert.match(md, /a\.js:1/);
});
