import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { listTasks, formatStatus } from './status.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-status-'));
  tmps.push(d);
  scaffoldSdlc(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('listTasks returns [] for a fresh repo', () => {
  const root = mktmp();
  assert.deepEqual(listTasks(root), []);
});

test('listTasks returns created tasks with their phase', () => {
  const root = mktmp();
  createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) });
  createTask(root, { title: 'Add export', type: 'feature', date: new Date(2026, 6, 5) });
  const tasks = listTasks(root);
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((t) => t.phase === 'intake'));
  // newest date first
  assert.ok(tasks[0].task.startsWith('20260706/'));
});

test('formatStatus renders a header and a friendly empty message', () => {
  assert.match(formatStatus([]), /No tasks yet/);
  const out = formatStatus([{ task: '20260706/x', phase: 'intake', gates: { spec_plan: 'pending' } }]);
  assert.match(out, /20260706\/x/);
  assert.match(out, /intake/);
});
