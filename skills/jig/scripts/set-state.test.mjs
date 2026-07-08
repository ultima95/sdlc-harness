import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { setPhase, advance, setGate, setField } from './set-state.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jig-set-'));
  tmps.push(root);
  scaffoldJig(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

function state(taskDir) { return JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8')); }
function spec(taskDir) { return fs.readFileSync(path.join(taskDir, 'spec.md'), 'utf8'); }

test('setPhase updates state.json and spec.md status', () => {
  const taskDir = newTask();
  setPhase(taskDir, 'implement');
  assert.equal(state(taskDir).phase, 'implement');
  assert.match(spec(taskDir), /^status: implement$/m);
});

test('advance moves to the next phase', () => {
  const taskDir = newTask();               // starts at intake
  assert.equal(advance(taskDir), 'spec_plan');
  assert.equal(state(taskDir).phase, 'spec_plan');
});

test('setGate updates the gate in state.json and spec.md', () => {
  const taskDir = newTask();
  setGate(taskDir, 'spec_plan', 'approved');
  assert.equal(state(taskDir).gates.spec_plan, 'approved');
  assert.match(spec(taskDir), /^gate_spec_plan: approved$/m);
});

test('setGate rejects an invalid gate or value', () => {
  const taskDir = newTask();
  assert.throws(() => setGate(taskDir, 'nope', 'approved'), /invalid gate/);
  assert.throws(() => setGate(taskDir, 'review', 'maybe'), /invalid gate value/);
});

test('setField writes a whitelisted key to state.json (not spec.md)', () => {
  const taskDir = newTask();
  setField(taskDir, 'branch', 'feature/fix-login');
  setField(taskDir, 'base', 'main');
  setField(taskDir, 'pr', '42');
  const s = state(taskDir);
  assert.equal(s.branch, 'feature/fix-login');
  assert.equal(s.base, 'main');
  assert.equal(s.pr, '42');
  // operational fields do NOT leak into the spec frontmatter
  assert.doesNotMatch(spec(taskDir), /^branch:/m);
});

test('setField rejects an unknown key', () => {
  const taskDir = newTask();
  assert.throws(() => setField(taskDir, 'nope', 'x'), /invalid field/);
});
