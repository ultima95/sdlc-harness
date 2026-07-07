import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { templatesDir } from './lib/paths.mjs';
import { renderShow, renderCheck } from './config.mjs';
import { scaffoldSdlc } from './scaffold.mjs';

const templateText = fs.readFileSync(path.join(templatesDir(), 'config.yml'), 'utf8');

test('renderShow lists keys with allowed values and a check hint', () => {
  const out = renderShow(templateText);
  assert.match(out, /gates\.review\s+hard\s+\[hard \| soft \| off\]/);
  assert.match(out, /Run `\/sdlc config check` to validate\./);
});

test('renderCheck reports zero errors for the scaffold', () => {
  assert.equal(renderCheck(templateText).errors, 0);
});

test('renderCheck reports errors for a broken config', () => {
  const broken = 'gates:\n  spec_plan: hard\n  review: maybe\n';
  const { report, errors } = renderCheck(broken);
  assert.ok(errors > 0);
  assert.match(report, /ERR\s+gates\.review/);
});

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'config.mjs');

const tmps = [];
function scaffolded() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-config-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return root;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

function run(root, args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

test('check exits 0 on the scaffolded config', () => {
  assert.equal(run(scaffolded(), ['check']).status, 0);
});

test('check exits 1 when a value is invalid', () => {
  const root = scaffolded();
  const cfg = path.join(root, '.sdlc', 'config.yml');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/review:\s+hard/, 'review: maybe'));
  const res = run(root, ['check']);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /ERR\s+gates\.review/);
});

test('get prints only the raw value; unknown key exits 1', () => {
  const root = scaffolded();
  assert.equal(run(root, ['get', 'gates.review']).stdout.trim(), 'hard');
  assert.equal(run(root, ['get', 'nope.key']).status, 1);
});

test('set writes the value and is read back by get', () => {
  const root = scaffolded();
  assert.equal(run(root, ['set', 'gates.review', 'soft']).status, 0);
  assert.equal(run(root, ['get', 'gates.review']).stdout.trim(), 'soft');
});

test('set rejects an invalid value and leaves the file unchanged', () => {
  const root = scaffolded();
  const cfg = path.join(root, '.sdlc', 'config.yml');
  const before = fs.readFileSync(cfg, 'utf8');
  assert.equal(run(root, ['set', 'gates.review', 'maybe']).status, 1);
  assert.equal(fs.readFileSync(cfg, 'utf8'), before);
});

test('missing .sdlc/config.yml tells the user to run init', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-noconf-'));
  tmps.push(root);
  const res = run(root, ['show']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /sdlc init/);
});
