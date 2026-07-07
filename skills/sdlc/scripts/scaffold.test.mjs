import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-scaffold-'));
  tmps.push(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('scaffoldSdlc creates config, memory files, and tasks dir', () => {
  const root = mktmp();
  const res = scaffoldSdlc(root);
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'config.yml')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'backlog.md')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'memory', 'architecture.md')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'memory', 'index.md')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'tasks', '.gitkeep')));
  assert.ok(res.created.length >= 10); // config + backlog + 7 memory + gitkeep
});

test('scaffoldSdlc is idempotent: second run skips existing files', () => {
  const root = mktmp();
  scaffoldSdlc(root);
  const res2 = scaffoldSdlc(root);
  assert.equal(res2.created.length, 0);
  assert.ok(res2.skipped.some(p => p.endsWith('config.yml')));
});

test('scaffoldSdlc with force overwrites existing files', () => {
  const root = mktmp();
  scaffoldSdlc(root);
  fs.writeFileSync(path.join(root, '.sdlc', 'config.yml'), 'tampered');
  const res = scaffoldSdlc(root, { force: true });
  assert.ok(res.created.some(p => p.endsWith('config.yml')));
  assert.notEqual(fs.readFileSync(path.join(root, '.sdlc', 'config.yml'), 'utf8'), 'tampered');
});
