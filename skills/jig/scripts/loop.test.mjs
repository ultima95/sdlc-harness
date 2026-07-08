import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { bumpLoop, resetLoop } from './loop.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-loop-'));
  tmps.push(root);
  scaffoldJig(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });
function loops(taskDir) { return JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8')).loops; }

test('bumpLoop increments from 0 and returns the new count', () => {
  const t = newTask();
  assert.equal(bumpLoop(t, 'test'), 1);
  assert.equal(bumpLoop(t, 'test'), 2);
  assert.equal(loops(t).test, 2);
  assert.equal(loops(t).review, 0); // other counter untouched
});

test('resetLoop sets the counter back to 0', () => {
  const t = newTask();
  bumpLoop(t, 'review');
  assert.equal(resetLoop(t, 'review'), 0);
  assert.equal(loops(t).review, 0);
});

test('bumpLoop and resetLoop reject an invalid loop key', () => {
  const t = newTask();
  assert.throws(() => bumpLoop(t, 'nope'), /invalid loop/);
  assert.throws(() => resetLoop(t, 'nope'), /invalid loop/);
});
