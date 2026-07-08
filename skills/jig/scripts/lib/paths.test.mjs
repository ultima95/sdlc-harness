import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findJigRoot, jigPaths, templatesDir } from './paths.mjs';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jig-paths-'));
}

test('jigPaths joins the standard layout under .jig by default', () => {
  const p = jigPaths('/proj');
  assert.equal(p.root, path.join('/proj', '.jig'));
  assert.equal(p.config, path.join('/proj', '.jig', 'config.yml'));
  assert.equal(p.backlog, path.join('/proj', '.jig', 'backlog.md'));
  assert.equal(p.memoryDir, path.join('/proj', '.jig', 'memory'));
  assert.equal(p.tasksDir, path.join('/proj', '.jig', 'tasks'));
});

test('jigPaths uses an existing legacy .sdlc dir', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.sdlc'));
  assert.equal(jigPaths(root).root, path.join(root, '.sdlc'));
});

test('jigPaths prefers .jig when both dirs exist', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.sdlc'));
  fs.mkdirSync(path.join(root, '.jig'));
  assert.equal(jigPaths(root).root, path.join(root, '.jig'));
});

test('findJigRoot finds the nearest ancestor containing .jig', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.jig'));
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findJigRoot(nested), root);
});

test('findJigRoot also finds a legacy .sdlc ancestor', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.sdlc'));
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(findJigRoot(nested), root);
});

test('findJigRoot returns null when no state dir exists', () => {
  const root = tmp();
  assert.equal(findJigRoot(root), null);
});

test('templatesDir points at the skill templates directory', () => {
  assert.ok(fs.existsSync(path.join(templatesDir(), 'config.yml')));
});
