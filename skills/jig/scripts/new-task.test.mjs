import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-task-'));
  tmps.push(d);
  scaffoldJig(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('createTask writes spec/progress/review/state with a date/slug id', () => {
  const root = mktmp();
  const { taskId, taskDir, slug } = createTask(root, {
    title: 'Fix Login Timeout', type: 'bug', date: new Date(2026, 6, 6),
  });
  assert.equal(slug, 'fix-login-timeout');
  assert.equal(taskId, '20260706/fix-login-timeout');
  for (const f of ['spec.md', 'progress.md', 'review.md', 'state.json']) {
    assert.ok(fs.existsSync(path.join(taskDir, f)), `${f} should exist`);
  }
  const spec = fs.readFileSync(path.join(taskDir, 'spec.md'), 'utf8');
  assert.ok(spec.includes('id: 20260706/fix-login-timeout'));
  assert.ok(spec.includes('type: bug'));
  assert.ok(spec.includes('track: fast')); // bug defaults to the fast track
  assert.ok(!spec.includes('{{'), 'all template vars must be substituted');
  const state = JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8'));
  assert.equal(state.phase, 'intake');
  assert.equal(state.track, 'fast');
});

test('createTask defaults track from type and honors an override', () => {
  const root = mktmp();
  const bug = createTask(root, { title: 'Bug one', type: 'bug', date: new Date(2026, 6, 6) });
  assert.equal(bug.track, 'fast');
  const urgent = createTask(root, { title: 'Bug two', type: 'bug', track: 'hotfix', date: new Date(2026, 6, 6) });
  assert.equal(urgent.track, 'hotfix');
});

test('createTask rejects an invalid track', () => {
  const root = mktmp();
  assert.throws(() => createTask(root, { title: 'x', type: 'bug', track: 'nope' }), /invalid track/);
});

test('createTask disambiguates same-day slug collisions', () => {
  const root = mktmp();
  const a = createTask(root, { title: 'Add CSV export', date: new Date(2026, 6, 6) });
  const b = createTask(root, { title: 'Add CSV export', date: new Date(2026, 6, 6) });
  assert.equal(a.slug, 'add-csv-export');
  assert.equal(b.slug, 'add-csv-export-2');
});

test('createTask rejects an invalid type', () => {
  const root = mktmp();
  assert.throws(() => createTask(root, { title: 'x', type: 'nope' }), /invalid type/);
});
