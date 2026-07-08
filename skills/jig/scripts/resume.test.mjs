import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { setPhase } from './set-state.mjs';
import { resumableTasks } from './resume.mjs';

const tmps = [];
function mktmp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-res-'));
  tmps.push(root);
  scaffoldJig(root);
  return root;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('resumableTasks is empty for a fresh repo', () => {
  assert.deepEqual(resumableTasks(mktmp()), []);
});

test('resumableTasks excludes done tasks and keeps active ones', () => {
  const root = mktmp();
  const a = createTask(root, { title: 'task one', type: 'bug', date: new Date(2026, 6, 6) });
  const b = createTask(root, { title: 'task two', type: 'bug', date: new Date(2026, 6, 6) });
  setPhase(a.taskDir, 'done');
  const r = resumableTasks(root);
  assert.equal(r.length, 1);
  assert.equal(r[0].task, b.taskId);
  assert.notEqual(r[0].phase, 'done');
});
