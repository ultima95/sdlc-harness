import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newTaskState, readState, writeState } from './state.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jig-state-'));
  tmps.push(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('newTaskState has the expected initial shape', () => {
  const s = newTaskState({ taskId: '20260706/x', type: 'bug', track: 'fast', created: '2026-07-06' });
  assert.equal(s.task, '20260706/x');
  assert.equal(s.type, 'bug');
  assert.equal(s.track, 'fast');
  assert.equal(s.phase, 'intake');
  assert.deepEqual(s.gates, { spec_plan: 'pending', review: 'pending' });
  assert.deepEqual(s.loops, { test: 0, review: 0 });
});

test('newTaskState defaults track to full when omitted', () => {
  const s = newTaskState({ taskId: '20260706/y', type: 'feature', created: '2026-07-06' });
  assert.equal(s.track, 'full');
});

test('writeState persists and readState round-trips, stamping updated', () => {
  const dir = mktmp();
  const s = newTaskState({ taskId: '20260706/x', type: 'bug', created: '2026-07-06' });
  const written = writeState(dir, s);
  assert.ok(typeof written.updated === 'string' && !Number.isNaN(Date.parse(written.updated)));
  const read = readState(dir);
  assert.equal(read.task, '20260706/x');
  assert.equal(read.phase, 'intake');
});
