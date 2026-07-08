import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { appendProgress } from './progress.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-prog-'));
  tmps.push(root);
  scaffoldJig(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });
const read = (taskDir) => fs.readFileSync(path.join(taskDir, 'progress.md'), 'utf8');

test('appendProgress appends a dated section without clobbering existing content', () => {
  const taskDir = newTask();
  const before = read(taskDir);
  appendProgress(taskDir, 'implement', 'wrote the code');
  const after = read(taskDir);
  assert.ok(after.startsWith(before), 'existing content preserved (appended, not overwritten)');
  assert.match(after, /## \d{4}-\d{2}-\d{2} — implement/);
  assert.match(after, /- wrote the code/);
});

test('appendProgress adds distinct entries on repeated calls', () => {
  const taskDir = newTask();
  appendProgress(taskDir, 'test', 'ran tests');
  appendProgress(taskDir, 'ship', 'opened PR #12');
  const md = read(taskDir);
  assert.match(md, /— test/);
  assert.match(md, /— ship/);
  assert.match(md, /opened PR #12/);
});
