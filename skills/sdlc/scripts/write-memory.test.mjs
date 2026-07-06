import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeFindings, renderMemory, writeMemory } from './write-memory.mjs';

const tmps = [];
function mktmp() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-mem-')); tmps.push(d); return d; }
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('mergeFindings unions arrays, dedupes by key, first non-empty scalar wins', () => {
  const merged = mergeFindings([
    { overview: '', stack: ['Node'], modules: [{ path: 'a', purpose: 'A' }], runbook: { build: '' } },
    { overview: 'The app', stack: ['Node', 'React'], modules: [{ path: 'a', purpose: 'dupe' }, { path: 'b', purpose: 'B' }], runbook: { build: 'npm run build' } },
  ]);
  assert.equal(merged.overview, 'The app');
  assert.deepEqual(merged.stack, ['Node', 'React']);
  assert.equal(merged.modules.length, 2);          // 'a' deduped by path
  assert.equal(merged.modules[0].purpose, 'A');    // first occurrence wins
  assert.equal(merged.runbook.build, 'npm run build');
});

test('mergeFindings tolerates empty input', () => {
  const merged = mergeFindings([]);
  assert.equal(merged.overview, '');
  assert.deepEqual(merged.stack, []);
  assert.deepEqual(merged.modules, []);
});

test('renderMemory produces all 7 files with content and index links', () => {
  const r = renderMemory({
    overview: 'A demo app',
    stack: ['Node'],
    architecture: { summary: 'layered', boundaries: ['api|core'], components: [{ name: 'api', role: 'http' }] },
    modules: [{ path: 'src/api', purpose: 'routes' }],
    conventions: ['ESM only'],
    glossary: [{ term: 'SDLC', definition: 'lifecycle' }],
    runbook: { build: 'npm run build', test: 'npm test', run: 'npm start', notes: ['needs node 18'] },
    risks: [{ area: 'auth', note: 'no tests' }],
  });
  assert.equal(Object.keys(r).length, 7);
  assert.match(r['architecture.md'], /layered/);
  assert.match(r['architecture.md'], /\*\*api\*\* — http/);
  assert.match(r['modules.md'], /`src\/api` — routes/);
  assert.match(r['runbook.md'], /\*\*Test:\*\* npm test/);
  assert.match(r['glossary.md'], /\*\*SDLC\*\* — lifecycle/);
  assert.match(r['index.md'], /\[Architecture\]\(architecture\.md\)/);
  assert.match(r['index.md'], /A demo app/);
});

test('renderMemory uses placeholders for empty sections (never blank)', () => {
  const r = renderMemory({});
  assert.equal(Object.keys(r).length, 7);
  assert.match(r['modules.md'], /Not determined during Phase 0/);
  assert.match(r['risks.md'], /Not determined during Phase 0/);
});

test('writeMemory writes all 7 files under .sdlc/memory', () => {
  const root = mktmp();
  const written = writeMemory(root, { overview: 'x' });
  assert.equal(written.length, 7);
  const idx = path.join(root, '.sdlc', 'memory', 'index.md');
  assert.ok(fs.existsSync(idx));
  assert.match(fs.readFileSync(idx, 'utf8'), /x/);
});
