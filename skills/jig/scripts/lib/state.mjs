import fs from 'node:fs';
import path from 'node:path';

export function newTaskState({ taskId, type, track = 'full', created }) {
  return {
    task: taskId,
    type,
    track,
    phase: 'intake',
    gates: { spec_plan: 'pending', review: 'pending' },
    loops: { test: 0, review: 0 },
    created,
    updated: created,
  };
}

export function readState(taskDir) {
  return JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8'));
}

export function writeState(taskDir, state) {
  const next = { ...state, updated: new Date().toISOString() };
  fs.writeFileSync(path.join(taskDir, 'state.json'), JSON.stringify(next, null, 2) + '\n');
  return next;
}
