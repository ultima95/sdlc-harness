# SDLC Harness — Milestone 1: Skill Skeleton & Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable `sdlc` Claude Code skill whose deterministic data layer — scaffolding `.sdlc/`, creating date-slug task folders, listing status, reading/writing task state — is fully unit-tested, with a SKILL.md that dispatches `init | task | status`.

**Architecture:** The harness is a single skill directory (`skills/sdlc/`) installed via `npx skills`. All deterministic mechanics are small dependency-free Node ES-module scripts under `skills/sdlc/scripts/` (unit-tested with the built-in `node --test` runner). `SKILL.md` is a slim dispatcher that tells Claude which script to run for each sub-command. Runtime project data is scaffolded into the target repo's `.sdlc/` from bundled `templates/`. The interactive lifecycle phases (Intake → Ship) are deliberately out of scope for M1 and land in later milestone plans.

**Tech Stack:** Node.js ≥ 18 (ES modules, `node:fs`/`node:path`, built-in `node --test`), Markdown skill + templates, YAML config. No third-party dependencies.

**Scope of this milestone:**
- In: source-repo setup; `slug`, `paths`, `state` lib modules; `templates/`; `scaffold.mjs`; `new-task.mjs`; `status.mjs`; `SKILL.md` dispatcher for `init`/`task`(folder creation only)/`status`; README.
- Out (later milestones): Phase 0 investigation + memory synthesis; Intake/Spec&Plan/Implement/Test/Review/Ship guides; workflow JS; gates; resume; `marketplace.json`; fixtures dogfood harness.

---

## File Structure

```
package.json                          # source-repo test runner + ESM
.gitignore
README.md
skills/
  sdlc/
    SKILL.md                          # dispatcher: init | task | status
    scripts/
      lib/
        slug.mjs                      # slugify, uniqueSlug, dateStamp
        slug.test.mjs
        paths.mjs                     # findSdlcRoot, sdlcPaths, templatesDir
        paths.test.mjs
        state.mjs                     # newTaskState, readState, writeState
        state.test.mjs
      scaffold.mjs                    # scaffoldSdlc + CLI
      scaffold.test.mjs
      new-task.mjs                    # createTask + CLI
      new-task.test.mjs
      status.mjs                      # listTasks, formatStatus + CLI
      status.test.mjs
    templates/
      config.yml
      spec.md
      progress.md
      review.md
      memory/
        architecture.md  modules.md  conventions.md  glossary.md
        runbook.md  risks.md  index.md
```

Each script has one responsibility; `lib/` holds pure/low-level helpers reused by the CLI scripts. Tests live beside the code they cover.

---

### Task 1: Source-repo setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sdlc-harness",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Portable SDLC harness for AI coding agents, shipped as a Claude Code skill.",
  "engines": { "node": ">=18" },
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
.superpowers/
# Harness runtime data is per-target-repo, never committed in this source repo:
.sdlc/
# Scratch used by tests:
.tmp-test/
```

- [ ] **Step 3: Verify the test runner works with zero tests**

Run: `npm test`
Expected: exits 0 with a summary like `tests 0` / `pass 0` (no test files yet).

- [ ] **Step 4: Commit**

```bash
git init
git add package.json .gitignore
git commit -m "chore: source-repo setup for sdlc harness"
```

---

### Task 2: `slug` helpers (slugify, uniqueSlug, dateStamp)

Pure functions — the foundation for task-folder naming.

**Files:**
- Create: `skills/sdlc/scripts/lib/slug.mjs`
- Test: `skills/sdlc/scripts/lib/slug.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/lib/slug.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug, dateStamp } from './slug.mjs';

test('slugify lowercases, trims, and dashes spaces', () => {
  assert.equal(slugify('Fix Login Timeout'), 'fix-login-timeout');
});

test('slugify strips punctuation and collapses separators', () => {
  assert.equal(slugify('  Add   CSV_export! '), 'add-csv-export');
  assert.equal(slugify('Refactor auth module'), 'refactor-auth-module');
});

test('slugify caps length at 50 chars with no trailing dash', () => {
  const s = slugify('a'.repeat(60) + ' tail');
  assert.ok(s.length <= 50);
  assert.ok(!s.endsWith('-'));
});

test('uniqueSlug returns base when free, else -2, -3', () => {
  assert.equal(uniqueSlug('x', []), 'x');
  assert.equal(uniqueSlug('x', ['x']), 'x-2');
  assert.equal(uniqueSlug('x', ['x', 'x-2']), 'x-3');
});

test('dateStamp formats a Date as YYYYMMDD (local components)', () => {
  assert.equal(dateStamp(new Date(2026, 6, 6)), '20260706'); // month is 0-based: 6 = July
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/lib/slug.test.mjs`
Expected: FAIL — `Cannot find module './slug.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/lib/slug.mjs
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\s_]+/g, '-')     // separators (space, underscore) -> dash FIRST
    .replace(/[^a-z0-9-]/g, '')  // then strip remaining punctuation
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

export function uniqueSlug(base, existing) {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function dateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/lib/slug.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/slug.mjs skills/sdlc/scripts/lib/slug.test.mjs
git commit -m "feat: slug helpers for task folder naming"
```

---

### Task 3: `paths` helpers (findSdlcRoot, sdlcPaths, templatesDir)

**Files:**
- Create: `skills/sdlc/scripts/lib/paths.mjs`
- Test: `skills/sdlc/scripts/lib/paths.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/lib/paths.test.mjs
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/lib/paths.test.mjs`
Expected: FAIL — module not found. (The `templatesDir` test will also fail until Task 5 creates the templates; that is expected and re-verified in Task 5.)

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/lib/paths.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function findSdlcRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.sdlc'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function sdlcPaths(projectRoot) {
  const root = path.join(projectRoot, '.sdlc');
  return {
    root,
    config: path.join(root, 'config.yml'),
    memoryDir: path.join(root, 'memory'),
    tasksDir: path.join(root, 'tasks'),
  };
}

export function templatesDir() {
  // this file lives at skills/sdlc/scripts/lib/ ; templates are at skills/sdlc/templates/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'templates');
}
```

- [ ] **Step 4: Run the non-template tests to verify they pass**

Run: `node --test --test-name-pattern="sdlcPaths|findSdlcRoot" skills/sdlc/scripts/lib/paths.test.mjs`
Expected: PASS (3 tests). The `templatesDir` test stays red until Task 5.

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/paths.mjs skills/sdlc/scripts/lib/paths.test.mjs
git commit -m "feat: path helpers for locating .sdlc and templates"
```

---

### Task 4: `state` helpers (newTaskState, readState, writeState)

**Files:**
- Create: `skills/sdlc/scripts/lib/state.mjs`
- Test: `skills/sdlc/scripts/lib/state.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/lib/state.test.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newTaskState, readState, writeState } from './state.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-state-'));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/lib/state.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/lib/state.mjs
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/lib/state.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/state.mjs skills/sdlc/scripts/lib/state.test.mjs
git commit -m "feat: task state read/write helpers"
```

---

### Task 5: Bundled templates

These are the files `/sdlc init` and `/sdlc task` write into a target repo. `{{ID}}`, `{{TYPE}}`, `{{CREATED}}` are substituted by `new-task.mjs` (Task 7).

**Files:**
- Create: `skills/sdlc/templates/config.yml`
- Create: `skills/sdlc/templates/spec.md`
- Create: `skills/sdlc/templates/progress.md`
- Create: `skills/sdlc/templates/review.md`
- Create: `skills/sdlc/templates/memory/architecture.md`
- Create: `skills/sdlc/templates/memory/modules.md`
- Create: `skills/sdlc/templates/memory/conventions.md`
- Create: `skills/sdlc/templates/memory/glossary.md`
- Create: `skills/sdlc/templates/memory/runbook.md`
- Create: `skills/sdlc/templates/memory/risks.md`
- Create: `skills/sdlc/templates/memory/index.md`

- [ ] **Step 1: Create `templates/config.yml`**

```yaml
# .sdlc/config.yml — SDLC harness configuration for this repo.
project:
  build: "echo 'set project.build in .sdlc/config.yml'"
  test:  "echo 'set project.test in .sdlc/config.yml'"
  lint:  "echo 'set project.lint in .sdlc/config.yml'"
gates:
  spec_plan: hard        # hard | soft | off
  review:    hard        # hard | soft | off
trust_level: normal      # strict | normal | trusted
tracks:
  default_by_type:       # auto-suggested track per task type (overridable at Intake)
    feature:  full
    refactor: full
    bug:      fast
    chore:    fast
    # 'hotfix' track is selected explicitly for urgent work
loops:
  max_test: 3
  max_review: 2
memory:
  graph:   auto          # auto | on | off (use a code-graph MCP if present)
  refresh: on_ship       # on_ship | manual
review:
  dimensions: [correctness, security, tests, conventions]
  verify: adversarial     # spawn verifiers to refute findings
```

- [ ] **Step 2: Create `templates/spec.md`**

```markdown
---
id: {{ID}}
type: {{TYPE}}          # feature | bug | chore | refactor
track: {{TRACK}}        # full | fast | hotfix
status: intake          # intake | spec_plan | implement | test | review | ship | done
created: {{CREATED}}
gate_spec_plan: pending # pending | approved
gate_review: pending    # pending | approved
---

# {{ID}}

## Part 1 — Spec (the contract)

### Summary
<!-- One-line statement of the task. -->

### Context
<!-- Background + links into .sdlc/memory (architecture.md, modules.md). -->

### Problem / Goal
<!-- What the developer actually wants, distilled from the Intake dialogue. -->

### Requirements
1. <!-- Functional requirement -->

### Acceptance criteria
- [ ] <!-- Testable, checkable outcome — the definition of done. -->

### Out of scope
- <!-- Explicit non-goals. -->

### Assumptions & resolved questions
- <!-- Decisions locked during Intake so they aren't re-litigated. -->

## Part 2 — Plan (execution)

### Approach
<!-- Chosen approach + one line on why (alternatives considered). -->

### Affected files & modules
- <!-- Concrete paths, from .sdlc/memory/modules.md + risks.md. -->

### Steps
1. <!-- Ordered; each step = a concrete change mapped to file(s). -->

### Test plan
- <!-- Which test proves each acceptance criterion; new vs existing. -->

### Risks & rollback
- <!-- Blast radius, migration notes, how to back out. -->
```

- [ ] **Step 3: Create `templates/progress.md`**

```markdown
# Progress — {{ID}}

<!-- Append-only. Each phase adds a dated entry: what happened, decisions,
     commands run, and test results. This is the audit trail and the context
     used by `/sdlc resume`. Newest entries at the bottom. -->

## {{CREATED}} — intake
- Task created.
```

- [ ] **Step 4: Create `templates/review.md`**

```markdown
# Review — {{ID}}

<!-- Findings from the Review phase. `verdict` is real|refuted after adversarial
     verification; only `real` findings loop back to Implement. -->

| dimension | location | severity | claim | verdict | fix status |
|-----------|----------|----------|-------|---------|------------|
|           |          |          |       |         |            |
```

- [ ] **Step 5: Create the seven `templates/memory/*.md` files**

Each is a stub with a heading and a one-line note; Phase 0 (a later milestone) fills them. Create all seven:

`templates/memory/architecture.md`
```markdown
# Architecture

_System map and module boundaries. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/modules.md`
```markdown
# Modules

_Module index and each module's purpose. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/conventions.md`
```markdown
# Conventions

_Code style, patterns, and idioms. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/glossary.md`
```markdown
# Glossary

_Domain terms. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/runbook.md`
```markdown
# Runbook

_How to build, run, and test this project. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/risks.md`
```markdown
# Risks

_Fragile areas and gotchas. Populated by `/sdlc init` (Phase 0)._
```

`templates/memory/index.md`
```markdown
# Project Memory — Index

_Entry point / table of contents. Populated by `/sdlc init` (Phase 0)._

- [Architecture](architecture.md)
- [Modules](modules.md)
- [Conventions](conventions.md)
- [Glossary](glossary.md)
- [Runbook](runbook.md)
- [Risks](risks.md)
```

- [ ] **Step 6: Verify the `templatesDir` test from Task 3 now passes**

Run: `node --test skills/sdlc/scripts/lib/paths.test.mjs`
Expected: PASS (all 4 tests, including `templatesDir points at an existing directory with config.yml`).

- [ ] **Step 7: Commit**

```bash
git add skills/sdlc/templates
git commit -m "feat: bundled .sdlc templates (config, spec, progress, review, memory)"
```

---

### Task 6: `scaffold.mjs` — create `.sdlc/` from templates

**Files:**
- Create: `skills/sdlc/scripts/scaffold.mjs`
- Test: `skills/sdlc/scripts/scaffold.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/scaffold.test.mjs
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
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'memory', 'architecture.md')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'memory', 'index.md')));
  assert.ok(fs.existsSync(path.join(root, '.sdlc', 'tasks', '.gitkeep')));
  assert.ok(res.created.length >= 9); // config + 7 memory + gitkeep
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/scaffold.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/scaffold.mjs
import fs from 'node:fs';
import path from 'node:path';
import { sdlcPaths, templatesDir } from './lib/paths.mjs';

const MEMORY_FILES = [
  'architecture.md', 'modules.md', 'conventions.md',
  'glossary.md', 'runbook.md', 'risks.md', 'index.md',
];

export function scaffoldSdlc(targetRoot, { force = false } = {}) {
  const p = sdlcPaths(targetRoot);
  const tpl = templatesDir();
  const created = [];
  const skipped = [];

  fs.mkdirSync(p.memoryDir, { recursive: true });
  fs.mkdirSync(p.tasksDir, { recursive: true });

  const copy = (src, dest) => {
    if (fs.existsSync(dest) && !force) { skipped.push(dest); return; }
    fs.copyFileSync(src, dest);
    created.push(dest);
  };

  copy(path.join(tpl, 'config.yml'), p.config);
  for (const f of MEMORY_FILES) copy(path.join(tpl, 'memory', f), path.join(p.memoryDir, f));

  const gitkeep = path.join(p.tasksDir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) { fs.writeFileSync(gitkeep, ''); created.push(gitkeep); }

  return { created, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2] || process.cwd();
  const res = scaffoldSdlc(target, { force: process.argv.includes('--force') });
  console.log(`Scaffolded .sdlc in ${target}`);
  for (const f of res.created) console.log('  created', f);
  for (const f of res.skipped) console.log('  skipped (exists)', f);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/scaffold.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Manually smoke the CLI**

Run: `node skills/sdlc/scripts/scaffold.mjs .tmp-test/demo && ls -R .tmp-test/demo/.sdlc`
Expected: prints created paths; `.sdlc/config.yml`, `.sdlc/memory/*.md`, `.sdlc/tasks/.gitkeep` exist. Then: `rm -rf .tmp-test`.

- [ ] **Step 6: Commit**

```bash
git add skills/sdlc/scripts/scaffold.mjs skills/sdlc/scripts/scaffold.test.mjs
git commit -m "feat: scaffold .sdlc from bundled templates"
```

---

### Task 7: `new-task.mjs` — create a date/slug task folder

**Files:**
- Create: `skills/sdlc/scripts/new-task.mjs`
- Test: `skills/sdlc/scripts/new-task.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/new-task.test.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-task-'));
  tmps.push(d);
  scaffoldSdlc(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('createTask writes spec/progress/review/state with a date/slug id', () => {
  const root = mktmp();
  const { taskId, taskDir, slug } = createTask(root, {
    title: 'Fix Login Timeout', type: 'bug', date: new Date(2026, 6, 6),
  });
  assert.equal(slug, 'fix-login-timeout');
  assert.equal(taskId, '20260706/fix-login-timeout');
  for (const f of ['spec.md', 'progress.md', 'review.md', 'state.json']) {
    assert.ok(fs.existsSync(path.join(taskDir, f)), `${f} should exist`);
  }
  const spec = fs.readFileSync(path.join(taskDir, 'spec.md'), 'utf8');
  assert.ok(spec.includes('id: 20260706/fix-login-timeout'));
  assert.ok(spec.includes('type: bug'));
  assert.ok(spec.includes('track: fast')); // bug defaults to the fast track
  assert.ok(!spec.includes('{{'), 'all template vars must be substituted');
  const state = JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8'));
  assert.equal(state.phase, 'intake');
  assert.equal(state.track, 'fast');
});

test('createTask defaults track from type and honors an override', () => {
  const root = mktmp();
  const bug = createTask(root, { title: 'Bug one', type: 'bug', date: new Date(2026, 6, 6) });
  assert.equal(bug.track, 'fast');
  const urgent = createTask(root, { title: 'Bug two', type: 'bug', track: 'hotfix', date: new Date(2026, 6, 6) });
  assert.equal(urgent.track, 'hotfix');
});

test('createTask rejects an invalid track', () => {
  const root = mktmp();
  assert.throws(() => createTask(root, { title: 'x', type: 'bug', track: 'nope' }), /invalid track/);
});

test('createTask disambiguates same-day slug collisions', () => {
  const root = mktmp();
  const a = createTask(root, { title: 'Add CSV export', date: new Date(2026, 6, 6) });
  const b = createTask(root, { title: 'Add CSV export', date: new Date(2026, 6, 6) });
  assert.equal(a.slug, 'add-csv-export');
  assert.equal(b.slug, 'add-csv-export-2');
});

test('createTask rejects an invalid type', () => {
  const root = mktmp();
  assert.throws(() => createTask(root, { title: 'x', type: 'nope' }), /invalid type/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/new-task.test.mjs`
Expected: FAIL — `Cannot find module './new-task.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/new-task.mjs
import fs from 'node:fs';
import path from 'node:path';
import { sdlcPaths, templatesDir } from './lib/paths.mjs';
import { slugify, uniqueSlug, dateStamp } from './lib/slug.mjs';
import { newTaskState, writeState } from './lib/state.mjs';

const TYPES = ['feature', 'bug', 'chore', 'refactor'];
const TRACKS = ['full', 'fast', 'hotfix'];
const DEFAULT_TRACK_BY_TYPE = { feature: 'full', refactor: 'full', bug: 'fast', chore: 'fast' };

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

export function defaultTrack(type) {
  return DEFAULT_TRACK_BY_TYPE[type] || 'full';
}

export function createTask(projectRoot, { title, type = 'feature', track, date = new Date() }) {
  if (!TYPES.includes(type)) throw new Error(`invalid type: ${type} (expected ${TYPES.join('|')})`);
  const resolvedTrack = track ?? defaultTrack(type);
  if (!TRACKS.includes(resolvedTrack)) throw new Error(`invalid track: ${resolvedTrack} (expected ${TRACKS.join('|')})`);

  const p = sdlcPaths(projectRoot);
  const stamp = dateStamp(date);
  const dayDir = path.join(p.tasksDir, stamp);
  fs.mkdirSync(dayDir, { recursive: true });

  const existing = fs.readdirSync(dayDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const slug = uniqueSlug(slugify(title), existing);
  const taskDir = path.join(dayDir, slug);
  fs.mkdirSync(taskDir, { recursive: true });

  const taskId = `${stamp}/${slug}`;
  const created = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
  const vars = { ID: taskId, TYPE: type, TRACK: resolvedTrack, CREATED: created };
  const tpl = templatesDir();
  const render = (name) => fill(fs.readFileSync(path.join(tpl, name), 'utf8'), vars);

  fs.writeFileSync(path.join(taskDir, 'spec.md'), render('spec.md'));
  fs.writeFileSync(path.join(taskDir, 'progress.md'), render('progress.md'));
  fs.writeFileSync(path.join(taskDir, 'review.md'), render('review.md'));
  writeState(taskDir, newTaskState({ taskId, type, track: resolvedTrack, created }));

  return { taskId, taskDir, slug, track: resolvedTrack };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const title = process.argv[2];
  const type = process.argv[3] || 'feature';
  const track = process.argv[4]; // optional; defaults by type
  if (!title) {
    console.error('usage: node new-task.mjs "<title>" [feature|bug|chore|refactor] [full|fast|hotfix]');
    process.exit(1);
  }
  const { taskId, taskDir, track: t } = createTask(process.cwd(), { title, type, track });
  console.log('created task', taskId, `(track: ${t})`, 'at', taskDir);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/new-task.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/new-task.mjs skills/sdlc/scripts/new-task.test.mjs
git commit -m "feat: create date/slug task folders from templates"
```

---

### Task 8: `status.mjs` — list tasks and their state

**Files:**
- Create: `skills/sdlc/scripts/status.mjs`
- Test: `skills/sdlc/scripts/status.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// skills/sdlc/scripts/status.test.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { listTasks, formatStatus } from './status.mjs';

const tmps = [];
function mktmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-status-'));
  tmps.push(d);
  scaffoldSdlc(d);
  return d;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('listTasks returns [] for a fresh repo', () => {
  const root = mktmp();
  assert.deepEqual(listTasks(root), []);
});

test('listTasks returns created tasks with their phase', () => {
  const root = mktmp();
  createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) });
  createTask(root, { title: 'Add export', type: 'feature', date: new Date(2026, 6, 5) });
  const tasks = listTasks(root);
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((t) => t.phase === 'intake'));
  // newest date first
  assert.ok(tasks[0].task.startsWith('20260706/'));
});

test('formatStatus renders a header and a friendly empty message', () => {
  assert.match(formatStatus([]), /No tasks yet/);
  const out = formatStatus([{ task: '20260706/x', phase: 'intake', gates: { spec_plan: 'pending' } }]);
  assert.match(out, /20260706\/x/);
  assert.match(out, /intake/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/status.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// skills/sdlc/scripts/status.mjs
import fs from 'node:fs';
import path from 'node:path';
import { sdlcPaths } from './lib/paths.mjs';

export function listTasks(projectRoot) {
  const { tasksDir } = sdlcPaths(projectRoot);
  if (!fs.existsSync(tasksDir)) return [];
  const tasks = [];
  for (const day of fs.readdirSync(tasksDir)) {
    const dayPath = path.join(tasksDir, day);
    if (!fs.statSync(dayPath).isDirectory()) continue;
    for (const slug of fs.readdirSync(dayPath)) {
      const statePath = path.join(dayPath, slug, 'state.json');
      if (!fs.existsSync(statePath)) continue;
      try {
        tasks.push(JSON.parse(fs.readFileSync(statePath, 'utf8')));
      } catch { /* skip malformed state.json */ }
    }
  }
  return tasks.sort((a, b) => (a.task < b.task ? 1 : a.task > b.task ? -1 : 0));
}

export function formatStatus(tasks) {
  if (!tasks.length) return 'No tasks yet. Start one with: /sdlc task "<request>"';
  const header = 'TASK'.padEnd(40) + ' ' + 'PHASE'.padEnd(10) + ' GATES';
  const rows = tasks.map((t) => {
    const gates = Object.entries(t.gates || {}).map(([k, v]) => `${k}:${v}`).join(' ');
    return String(t.task).padEnd(40) + ' ' + String(t.phase).padEnd(10) + ' ' + gates;
  });
  return [header, ...rows].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(formatStatus(listTasks(process.cwd())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/status.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all suites PASS (slug, paths, state, scaffold, new-task, status).

- [ ] **Step 6: Commit**

```bash
git add skills/sdlc/scripts/status.mjs skills/sdlc/scripts/status.test.mjs
git commit -m "feat: list task status from .sdlc/tasks"
```

---

### Task 9: `SKILL.md` dispatcher

The skill Claude actually loads. It tells Claude how to run the scripts above. `<SKILL_DIR>` is the directory this `SKILL.md` lives in (Claude Code reports it as the skill's base directory when the skill is invoked); substitute the real absolute path when running commands.

**Files:**
- Create: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Write `SKILL.md`**

````markdown
---
name: sdlc
description: Run a gated software development life cycle for a repo. Use for `/sdlc init` (understand the codebase and scaffold project memory), `/sdlc task "<request>"` (start an issue/bug/feature through spec→implement→test→review→ship), `/sdlc status`, and `/sdlc resume`. Triggers on "sdlc", "run the lifecycle", "start a task", "sdlc init/status".
---

# SDLC Conductor

You drive a repeatable software development life cycle for the current repository.
Deterministic mechanics are Node scripts bundled in this skill under `scripts/`;
you run them and interpret the output. `<SKILL_DIR>` below is this skill's base
directory — use its absolute path when running commands. Node.js ≥ 18 is required.

## Dispatch

Parse the sub-command from the user's invocation (the word after `/sdlc`, or infer
from the request) and follow the matching section. If none matches, run **status**
and show the available sub-commands.

### init
Scaffold the harness data directory for this repo.

1. Run: `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"`
2. Report which files were created vs. skipped.
3. Tell the user: Project Memory files under `.sdlc/memory/` are empty stubs.
   Populating them (Phase 0 investigation) is added in a later milestone; for now
   they are placeholders they may edit by hand.
4. Do **not** overwrite an existing config unless the user explicitly asks; then
   re-run with `--force`.

### task
Create a new task folder for an issue/bug/feature.

1. Determine a short `title` from the user's request and a `type`
   (`feature` | `bug` | `chore` | `refactor`; default `feature`).
2. Propose a `track` (process weight): defaults by type are
   feature/refactor → `full`, bug/chore → `fast`; suggest `hotfix` when the
   user signals urgency. Confirm title, type, and track in one line before
   creating, and let the user override the track.
3. Run: `node "<SKILL_DIR>/scripts/new-task.mjs" "<title>" <type> <track>`
   (omit `<track>` to accept the type default).
4. Report the created `taskId`, its `track`, and path
   (`.sdlc/tasks/<YYYYMMDD>/<slug>/`).
5. Tell the user the task skeleton (`spec.md`, `progress.md`, `review.md`,
   `state.json`) is ready at phase `intake`. Driving the interactive phases
   (Intake → Spec & Plan → Implement → Test → Review → Ship, scaled by track)
   is added in later milestones.

### status
Show all tasks and their current phase/gate state.

1. Run: `node "<SKILL_DIR>/scripts/status.mjs"` from the repo root (`$(pwd)`).
2. Print the output verbatim.

### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.

## Notes
- All commands operate on the current working directory as the project root.
- If `.sdlc/` does not exist when running `task`/`status`, tell the user to run
  `/sdlc init` first.
````

- [ ] **Step 2: Verify the SKILL.md frontmatter is valid**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');if(!/description:/.test(m[1]))throw new Error('missing description');console.log('frontmatter OK');"
```
Expected: prints `frontmatter OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: sdlc conductor SKILL.md dispatching init/task/status"
```

---

### Task 10: README + end-to-end smoke

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# SDLC Harness

A portable software development life cycle for AI coding agents, shipped as a
single Claude Code skill. Phase 0 builds durable **Project Memory** from your
codebase; a per-task inner loop then takes each issue/bug/feature through
Intake → Spec & Plan → Implement → Test → Review → Ship with human gates.

> Status: Milestone 1 — installable skill + data layer (`init`, `task`, `status`).
> Lifecycle phases land in later milestones.

## Requirements
- Claude Code
- Node.js ≥ 18 (used by the harness's bundled scripts)

## Install
```bash
npx skills add <owner>/<repo>
```
Then restart your Claude Code session so the `sdlc` skill is picked up.

## Use
- `/sdlc init` — scaffold `.sdlc/` (config + Project Memory stubs) in the current repo.
- `/sdlc task "<request>"` — create a task folder at `.sdlc/tasks/<YYYYMMDD>/<slug>/`.
- `/sdlc status` — list tasks and their phase/gate state.

## Development
```bash
npm test   # runs the Node unit tests for the bundled scripts
```
```

- [ ] **Step 2: End-to-end smoke against a throwaway repo**

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug)
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/status.mjs)
```
Expected: scaffold prints created files; new-task prints `created task 202XXXXX/fix-login-timeout`; status prints a table row for that task at phase `intake`. Then: `rm -rf .tmp-test`.

- [ ] **Step 3: Full suite green**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README + milestone 1 usage"
```

---

## Self-Review notes (author)

- **Spec coverage (M1 slice):** installable single skill ✓ (Task 9); `.sdlc/` self-scaffold on init ✓ (Task 6/9); date/slug task layout `<YYYYMMDD>/<slug>/` ✓ (Task 7); `spec.md` two-part template + front-matter (incl. `track`) ✓ (Task 5); `state.json` shape with `type`/`track`/`spec_plan`/`review` gates ✓ (Task 4); tracks with per-type defaults + override + validation ✓ (Tasks 4/5/7/9); config schema from spec §9 (incl. `tracks.default_by_type`) ✓ (Task 5); status listing ✓ (Task 8). Deferred to later milestones (explicitly out of scope here): Phase 0 investigation/memory synthesis, Intake→Ship phase guides, per-track phase/gate enforcement, workflow JS, resume, `marketplace.json`, fixtures dogfood.
- **Placeholders:** none — every step has runnable code/commands. Template `{{VAR}}` tokens (`ID`, `TYPE`, `TRACK`, `CREATED`) are intentional and asserted-substituted by Task 7's tests.
- **Type consistency:** `scaffoldSdlc`, `createTask`, `defaultTrack`, `newTaskState`, `readState`, `writeState`, `listTasks`, `formatStatus`, `slugify`, `uniqueSlug`, `dateStamp` — names/signatures used identically across tasks and tests. Gate keys are `spec_plan` and `review` in both `state.json` (Task 4) and `config.yml` (Task 5); track values `full|fast|hotfix` and per-type defaults match between `new-task.mjs` (Task 7) and `config.yml` (Task 5), matching the spec.
```
