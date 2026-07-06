import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findSdlcRoot, sdlcPaths, templatesDir } from './paths.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-paths-'));
  tmps.push(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('sdlcPaths joins the standard layout', () => {
  const p = sdlcPaths('/proj');
  assert.equal(p.root, path.join('/proj', '.sdlc'));
  assert.equal(p.config, path.join('/proj', '.sdlc', 'config.yml'));
  assert.equal(p.memoryDir, path.join('/proj', '.sdlc', 'memory'));
  assert.equal(p.tasksDir, path.join('/proj', '.sdlc', 'tasks'));
});

test('findSdlcRoot finds the nearest ancestor containing .sdlc', () => {
  const root = mktmp();
  fs.mkdirSync(path.join(root, '.sdlc'));
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findSdlcRoot(nested), root);
});

test('findSdlcRoot returns null when no .sdlc exists', () => {
  const root = mktmp();
  assert.equal(findSdlcRoot(root), null);
});

test('templatesDir points at an existing directory with config.yml', () => {
  const dir = templatesDir();
  assert.ok(fs.existsSync(path.join(dir, 'config.yml')), 'templates/config.yml must exist');
});
