import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldJig } from './scaffold.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-scaffold-'));
  tmps.push(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('scaffoldJig creates config, memory files, and tasks dir', () => {
  const root = mktmp();
  const res = scaffoldJig(root);
  assert.ok(fs.existsSync(path.join(root, '.jig', 'config.yml')));
  assert.ok(fs.existsSync(path.join(root, '.jig', 'backlog.md')));
  assert.ok(fs.existsSync(path.join(root, '.jig', 'memory', 'architecture.md')));
  assert.ok(fs.existsSync(path.join(root, '.jig', 'memory', 'index.md')));
  assert.ok(fs.existsSync(path.join(root, '.jig', 'tasks', '.gitkeep')));
  assert.ok(res.created.length >= 10); // config + backlog + 7 memory + gitkeep
});

test('scaffoldJig is idempotent: second run skips existing files', () => {
  const root = mktmp();
  scaffoldJig(root);
  const res2 = scaffoldJig(root);
  assert.equal(res2.created.length, 0);
  assert.ok(res2.skipped.some(p => p.endsWith('config.yml')));
});

test('scaffoldJig with force overwrites existing files', () => {
  const root = mktmp();
  scaffoldJig(root);
  fs.writeFileSync(path.join(root, '.jig', 'config.yml'), 'tampered');
  const res = scaffoldJig(root, { force: true });
  assert.ok(res.created.some(p => p.endsWith('config.yml')));
  assert.notEqual(fs.readFileSync(path.join(root, '.jig', 'config.yml'), 'utf8'), 'tampered');
});
