# SDLC Harness — Milestone 2: Phase 0 (Understand the codebase → Project Memory) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/sdlc init` (and a new `/sdlc memory-refresh`) investigate the current repo with parallel explorer subagents and populate `.sdlc/memory/` with real Project Memory, via a deterministic, unit-tested memory writer.

**Architecture:** Phase 0 splits into an LLM half and a deterministic half. The LLM half is a phase guide (`phases/understand.md`) that dispatches parallel `explorer` subagents (role prompt in `agents/explorer.md`); each returns a strict-JSON *slice* of a shared findings schema. The deterministic half is `scripts/write-memory.mjs`, which **merges** the slices, **renders** the seven memory markdown files, and **writes** them — this half is fully unit-tested. No Workflow-tool dependency (portable). `SKILL.md`'s `init` is extended to run Phase 0 after scaffolding.

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), Markdown skill guides, Agent tool for subagent fan-out. No third-party deps.

**Depends on:** Milestone 1 (on `main`): `scripts/lib/paths.mjs` (`sdlcPaths`), `scaffold.mjs`, existing `SKILL.md`, `.sdlc/` scaffolding, memory template stubs.

**Scope of this milestone:**
- In: the findings schema; `agents/explorer.md`; `scripts/write-memory.mjs` (`mergeFindings`, `renderMemory`, `writeMemory` + CLI) with tests; `phases/understand.md`; `SKILL.md` `init` wired to Phase 0 + new `memory-refresh`; `fixtures/sample-repo/` for dogfooding.
- Out (later milestones): the inner-loop phase guides (Intake→Ship); review/ship workflows; the optional code-graph MCP index (guide mentions it as best-effort only); gate enforcement; resume.

**Testability boundary (no silent caps):** The explorer investigation is LLM-driven and cannot be unit-tested; it is validated by a **manual live acceptance** step (run `/sdlc init` on `fixtures/sample-repo`). Everything deterministic — merge, render, write — is unit-tested, and a scripted smoke feeds canned slices through `write-memory.mjs` to prove the persist path end-to-end without live agents.

---

## Findings schema (the contract between explorers and `write-memory.mjs`)

Each explorer returns a JSON object containing ONLY the keys relevant to its slice. `mergeFindings` combines many such partial objects into one:

```jsonc
{
  "overview": "one-paragraph plain-English summary of what the system is",
  "stack": ["Node 18", "React", "PostgreSQL"],
  "architecture": {
    "summary": "how the system is structured, in a few sentences",
    "boundaries": ["api ⟷ core", "core ⟷ db"],
    "components": [{ "name": "api", "role": "HTTP layer" }]
  },
  "modules": [{ "path": "src/api", "purpose": "route handlers" }],
  "conventions": ["ES modules only", "tests colocated as *.test.mjs"],
  "glossary": [{ "term": "Track", "definition": "process weight of a task" }],
  "runbook": { "build": "npm run build", "test": "npm test", "run": "npm start", "notes": ["needs Node >= 18"] },
  "risks": [{ "area": "auth", "note": "no tests around token expiry" }]
}
```

Merge rules (implemented in Task 2): string arrays → dedupe preserving order; object arrays → dedupe by key (`modules`→`path`, `glossary`→`term`, `components`→`name`, `risks`→`area::note`); scalars (`overview`, `architecture.summary`, `runbook.build/test/run`) → first non-empty wins.

## File Structure

```
skills/sdlc/
  agents/
    explorer.md              # NEW: explorer subagent role prompt
  scripts/
    write-memory.mjs         # NEW: mergeFindings + renderMemory + writeMemory + CLI
    write-memory.test.mjs    # NEW
  phases/
    understand.md            # NEW: Phase 0 guide the conductor follows
  SKILL.md                   # MODIFIED: init runs Phase 0; add memory-refresh
fixtures/
  sample-repo/               # NEW: tiny repo to dogfood /sdlc init against
    package.json  README.md  src/index.js  src/greet.js
  sample-slices/             # NEW: canned findings slices for the persist-half smoke
    structure.json  runbook.json
```

---

### Task 1: Explorer role prompt (`agents/explorer.md`)

**Files:**
- Create: `skills/sdlc/agents/explorer.md`

- [ ] **Step 1: Create `skills/sdlc/agents/explorer.md`** with exactly:

```markdown
# Explorer (Phase 0 subagent)

You are a read-only codebase explorer. You investigate ONE assigned slice of a
repository and return findings as STRICT JSON. You do not modify anything.

## Inputs (provided in your dispatch prompt)
- `repoRoot`: absolute path to the repository to investigate.
- `slice`: the aspect you own — one of `structure`, `stack`, `modules`,
  `conventions`, `runbook`, `risks`.

## What to do
1. Explore `repoRoot` read-only (list files, read key files, configs, manifests,
   entry points). Stay within your slice; don't try to cover everything.
2. Produce findings for ONLY the keys relevant to your slice (see mapping).

## Slice → keys mapping
- `structure`  → `overview`, `architecture` ({summary, boundaries, components})
- `stack`      → `stack` (languages, frameworks, runtimes, notable deps)
- `modules`    → `modules` ([{path, purpose}] for the main directories/modules)
- `conventions`→ `conventions` ([string] — style, patterns, idioms, test layout)
- `runbook`    → `runbook` ({build, test, run, notes[]} — real commands from
  package.json / Makefile / docs)
- `risks`      → `risks` ([{area, note}] — fragile spots, gotchas, missing tests)

## Output — STRICT rules
- Return ONLY a single JSON object. No prose, no markdown fences, no commentary.
- Include ONLY the keys for your slice. Omit unknown keys rather than guessing.
- If you genuinely find nothing for your slice, return `{}`.
- Keep strings concise and factual; base them on what you actually read.

## Example (slice = runbook)
{"runbook":{"build":"npm run build","test":"npm test","run":"node src/index.js","notes":["requires Node >= 18"]}}
```

- [ ] **Step 2: Verify the file exists and documents all six slices**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/agents/explorer.md','utf8');for(const k of ['structure','stack','modules','conventions','runbook','risks']){if(!s.includes(k))throw new Error('missing slice: '+k)}if(!/STRICT JSON/.test(s))throw new Error('missing strict-json rule');console.log('explorer.md OK')"`
Expected: prints `explorer.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/agents/explorer.md
git commit -m "feat: explorer subagent role prompt for Phase 0"
```

---

### Task 2: Deterministic memory writer (`scripts/write-memory.mjs`)

The testable core: merge slices → render 7 files → write. Follow TDD.

**Files:**
- Create: `skills/sdlc/scripts/write-memory.mjs`
- Test: `skills/sdlc/scripts/write-memory.test.mjs`

- [ ] **Step 1: Write the failing tests** — create `skills/sdlc/scripts/write-memory.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test skills/sdlc/scripts/write-memory.test.mjs`
Expected: FAIL — `Cannot find module './write-memory.mjs'`.

- [ ] **Step 3: Write the implementation** — create `skills/sdlc/scripts/write-memory.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { sdlcPaths } from './lib/paths.mjs';

function uniqStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr || []) {
    if (s == null) continue;
    const k = String(s);
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const o of arr || []) {
    if (!o) continue;
    const k = keyFn(o);
    if (!seen.has(k)) { seen.add(k); out.push(o); }
  }
  return out;
}

function firstNonEmpty(vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

export function mergeFindings(slices) {
  const s = (Array.isArray(slices) ? slices : []).filter(Boolean);
  return {
    overview: firstNonEmpty(s.map((x) => x.overview)),
    stack: uniqStrings(s.flatMap((x) => x.stack || [])),
    architecture: {
      summary: firstNonEmpty(s.map((x) => x.architecture?.summary)),
      boundaries: uniqStrings(s.flatMap((x) => x.architecture?.boundaries || [])),
      components: uniqBy(s.flatMap((x) => x.architecture?.components || []), (c) => c.name),
    },
    modules: uniqBy(s.flatMap((x) => x.modules || []), (m) => m.path),
    conventions: uniqStrings(s.flatMap((x) => x.conventions || [])),
    glossary: uniqBy(s.flatMap((x) => x.glossary || []), (g) => g.term),
    runbook: {
      build: firstNonEmpty(s.map((x) => x.runbook?.build)),
      test: firstNonEmpty(s.map((x) => x.runbook?.test)),
      run: firstNonEmpty(s.map((x) => x.runbook?.run)),
      notes: uniqStrings(s.flatMap((x) => x.runbook?.notes || [])),
    },
    risks: uniqBy(s.flatMap((x) => x.risks || []), (r) => `${r.area}::${r.note}`),
  };
}

const NONE = '_Not determined during Phase 0._';

function bullets(items, fmt) {
  if (!items || !items.length) return NONE;
  return items.map(fmt).join('\n');
}

export function renderMemory(findings) {
  const f = findings || {};
  const arch = f.architecture || {};
  const run = f.runbook || {};

  return {
    'architecture.md': `# Architecture

${f.overview || NONE}

## System summary
${arch.summary || NONE}

## Boundaries
${bullets(arch.boundaries, (b) => `- ${b}`)}

## Components
${bullets(arch.components, (c) => `- **${c.name}** — ${c.role || ''}`.trimEnd())}
`,
    'modules.md': `# Modules

${bullets(f.modules, (m) => `- \`${m.path}\` — ${m.purpose || ''}`.trimEnd())}
`,
    'conventions.md': `# Conventions

${bullets(f.conventions, (c) => `- ${c}`)}
`,
    'glossary.md': `# Glossary

${bullets(f.glossary, (g) => `- **${g.term}** — ${g.definition || ''}`.trimEnd())}
`,
    'runbook.md': `# Runbook

- **Build:** ${run.build || NONE}
- **Test:** ${run.test || NONE}
- **Run:** ${run.run || NONE}

## Notes
${bullets(run.notes, (n) => `- ${n}`)}
`,
    'risks.md': `# Risks

${bullets(f.risks, (r) => `- **${r.area}** — ${r.note || ''}`.trimEnd())}
`,
    'index.md': `# Project Memory — Index

${f.overview || NONE}

## Tech stack
${bullets(f.stack, (s) => `- ${s}`)}

## Contents
- [Architecture](architecture.md)
- [Modules](modules.md)
- [Conventions](conventions.md)
- [Glossary](glossary.md)
- [Runbook](runbook.md)
- [Risks](risks.md)
`,
  };
}

export function writeMemory(projectRoot, findings) {
  const { memoryDir } = sdlcPaths(projectRoot);
  fs.mkdirSync(memoryDir, { recursive: true });
  const rendered = renderMemory(findings);
  const written = [];
  for (const [name, content] of Object.entries(rendered)) {
    const dest = path.join(memoryDir, name);
    fs.writeFileSync(dest, content.endsWith('\n') ? content : content + '\n');
    written.push(dest);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [projectRoot, ...sliceFiles] = process.argv.slice(2);
  if (!projectRoot || !sliceFiles.length) {
    console.error('usage: node write-memory.mjs <projectRoot> <slice1.json> [slice2.json ...]');
    process.exit(1);
  }
  const slices = sliceFiles.map((fp) => JSON.parse(fs.readFileSync(fp, 'utf8')));
  const findings = mergeFindings(slices);
  const written = writeMemory(projectRoot, findings);
  console.log(`Wrote ${written.length} memory files to ${sdlcPaths(projectRoot).memoryDir}`);
  for (const w of written) console.log('  ', w);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test skills/sdlc/scripts/write-memory.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/write-memory.mjs skills/sdlc/scripts/write-memory.test.mjs
git commit -m "feat: deterministic Project Memory writer (merge/render/write)"
```

---

### Task 3: Phase 0 guide (`phases/understand.md`)

**Files:**
- Create: `skills/sdlc/phases/understand.md`

- [ ] **Step 1: Create `skills/sdlc/phases/understand.md`** with exactly:

```markdown
# Phase 0 — Understand the codebase

Goal: investigate this repository and populate `.sdlc/memory/` with Project Memory.
Run by `/sdlc init` (first time) and `/sdlc memory-refresh` (subsequent). `<SKILL_DIR>`
is this skill's base directory. The project root is the current working directory.

## Steps

1. **Precondition.** Ensure `.sdlc/` exists (init scaffolds it first). If it does not,
   run `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"`.

2. **Fan out explorers.** Dispatch SIX `explorer` subagents IN PARALLEL (one Agent
   tool call each, in a single message so they run concurrently). Give each the
   role prompt from `<SKILL_DIR>/agents/explorer.md`, the `repoRoot` (the current
   working directory, absolute), and its `slice`. The six slices are:
   `structure`, `stack`, `modules`, `conventions`, `runbook`, `risks`.
   Each explorer returns a strict-JSON object for its slice.

3. **Save slices.** Write each explorer's JSON output to
   `.sdlc/memory/.slices/<slice>.json` (create the `.slices/` dir). If an explorer
   returned prose around the JSON, extract the single JSON object; if it returned
   `{}` or failed, save `{}` for that slice.

4. **Build memory.** Run:
   `node "<SKILL_DIR>/scripts/write-memory.mjs" "$(pwd)" .sdlc/memory/.slices/structure.json .sdlc/memory/.slices/stack.json .sdlc/memory/.slices/modules.json .sdlc/memory/.slices/conventions.json .sdlc/memory/.slices/runbook.json .sdlc/memory/.slices/risks.json`
   This merges the slices and (re)writes the seven memory markdown files.

5. **Optional graph index.** If `.sdlc/config.yml` has `memory.graph` set to `on` or
   `auto` AND a code-graph MCP is available in this session, additionally index the
   repo with it (best-effort). If no such MCP is present, skip silently — markdown
   is the source of truth.

6. **Report.** Tell the user which memory files were populated and suggest they skim
   `.sdlc/memory/index.md`. Note that `.sdlc/memory/.slices/` holds the raw findings.

## Notes
- Explorers are READ-ONLY; they must not modify the repo.
- Keep the fan-out to one round of six; do not recurse.
- `write-memory.mjs` always writes all seven files (empty sections get a placeholder),
  so memory is never left blank.
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/understand.md','utf8');for(const t of ['Fan out explorers','write-memory.mjs','structure','risks','index.md']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('understand.md OK')"`
Expected: prints `understand.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/understand.md
git commit -m "feat: Phase 0 understand-the-codebase guide"
```

---

### Task 4: Wire Phase 0 into `SKILL.md` (`init` + `memory-refresh`)

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace the `### init` section.** Find this exact block:

```markdown
### init
Scaffold the harness data directory for this repo.

1. Run: `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"`
2. Report which files were created vs. skipped.
3. Tell the user: Project Memory files under `.sdlc/memory/` are empty stubs.
   Populating them (Phase 0 investigation) is added in a later milestone; for now
   they are placeholders they may edit by hand.
4. Do **not** overwrite an existing config unless the user explicitly asks; then
   re-run with `--force`.
```

Replace it with:

```markdown
### init
Scaffold `.sdlc/`, then run Phase 0 to build Project Memory.

1. Run: `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"` and report created vs. skipped.
2. Run **Phase 0 — understand the codebase**: follow `<SKILL_DIR>/phases/understand.md`
   to fan out explorer subagents, merge their findings, and populate `.sdlc/memory/`.
3. Report which memory files were populated and suggest the user skim
   `.sdlc/memory/index.md`.
4. Do **not** overwrite an existing config unless the user explicitly asks (`--force`).
```

- [ ] **Step 2: Replace the `### resume` section to add `memory-refresh` before it.** Find this exact block:

```markdown
### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.
```

Replace it with:

```markdown
### memory-refresh
Re-run Phase 0 to refresh Project Memory (e.g., after significant changes).
Follow `<SKILL_DIR>/phases/understand.md`; it overwrites the memory files.

### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.
```

- [ ] **Step 3: Update the frontmatter `description`** to mention memory-refresh. Find:

```
description: Run a gated software development life cycle for a repo. Use for `/sdlc init` (understand the codebase and scaffold project memory), `/sdlc task "<request>"` (start an issue/bug/feature through spec→implement→test→review→ship), `/sdlc status`, and `/sdlc resume`. Triggers on "sdlc", "run the lifecycle", "start a task", "sdlc init/status".
```

Replace with:

```
description: Run a gated software development life cycle for a repo. Use for `/sdlc init` (understand the codebase and scaffold project memory), `/sdlc task "<request>"` (start an issue/bug/feature through spec→implement→test→review→ship), `/sdlc status`, `/sdlc memory-refresh`, and `/sdlc resume`. Triggers on "sdlc", "run the lifecycle", "start a task", "sdlc init/status".
```

- [ ] **Step 4: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['### init','### task','### status','### memory-refresh','### resume','phases/understand.md']){if(!s.includes(t))throw new Error('missing: '+t)}if(/empty stubs/.test(s))throw new Error('old init text still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: wire Phase 0 into /sdlc init and add /sdlc memory-refresh"
```

---

### Task 5: Fixtures + persist-half smoke + full suite

**Files:**
- Create: `fixtures/sample-repo/package.json`
- Create: `fixtures/sample-repo/README.md`
- Create: `fixtures/sample-repo/src/index.js`
- Create: `fixtures/sample-repo/src/greet.js`
- Create: `fixtures/sample-slices/structure.json`
- Create: `fixtures/sample-slices/runbook.json`

- [ ] **Step 1: Create the sample repo files**

`fixtures/sample-repo/package.json`
```json
{
  "name": "sample-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "echo build",
    "test": "node --test",
    "start": "node src/index.js"
  }
}
```

`fixtures/sample-repo/README.md`
```markdown
# Sample App

A tiny app used to dogfood the SDLC harness's Phase 0 investigation.
It greets a name from the command line.
```

`fixtures/sample-repo/src/index.js`
```js
import { greet } from './greet.js';

const name = process.argv[2] || 'world';
console.log(greet(name));
```

`fixtures/sample-repo/src/greet.js`
```js
export function greet(name) {
  return `Hello, ${name}!`;
}
```

- [ ] **Step 2: Create canned findings slices** (for the agent-free persist smoke)

`fixtures/sample-slices/structure.json`
```json
{
  "overview": "A tiny Node CLI that greets a name.",
  "architecture": {
    "summary": "Single entry point delegating to a greet helper.",
    "boundaries": ["index ⟷ greet"],
    "components": [{ "name": "index", "role": "CLI entry" }, { "name": "greet", "role": "greeting helper" }]
  },
  "modules": [
    { "path": "src/index.js", "purpose": "CLI entry point" },
    { "path": "src/greet.js", "purpose": "greeting function" }
  ]
}
```

`fixtures/sample-slices/runbook.json`
```json
{
  "stack": ["Node.js (ESM)"],
  "conventions": ["ES modules only"],
  "runbook": { "build": "npm run build", "test": "npm test", "run": "node src/index.js", "notes": ["requires Node >= 18"] },
  "risks": [{ "area": "input", "note": "no validation on argv" }]
}
```

- [ ] **Step 3: Persist-half smoke** — feed the canned slices through the writer against the sample repo (no live agents), then confirm memory is populated:

```bash
node skills/sdlc/scripts/write-memory.mjs fixtures/sample-repo fixtures/sample-slices/structure.json fixtures/sample-slices/runbook.json
node -e "const fs=require('fs');const p='fixtures/sample-repo/.sdlc/memory/';const idx=fs.readFileSync(p+'index.md','utf8');const mod=fs.readFileSync(p+'modules.md','utf8');if(!/greets a name/.test(idx))throw new Error('overview missing');if(!/src\/index\.js/.test(mod))throw new Error('module missing');if(/{{/.test(idx))throw new Error('token left');console.log('persist smoke OK')"
```
Expected: writer prints "Wrote 7 memory files…"; the check prints `persist smoke OK`. Note: `fixtures/sample-repo/.sdlc/` is gitignored (transient); clean it: `rm -rf fixtures/sample-repo/.sdlc`.

- [ ] **Step 4: Full suite**

Run: `npm test`
Expected: all previous tests plus the 5 new `write-memory` tests pass (`fail 0`). Paste the totals line.

- [ ] **Step 5: Commit**

```bash
git add fixtures/
git commit -m "test: sample-repo fixtures + canned slices for Phase 0 dogfooding"
```

- [ ] **Step 6: Manual live acceptance (document, do not automate)**

Record in the task report that full Phase 0 (live explorers) is validated by the human running, from a clean checkout:
```
cd fixtures/sample-repo && /sdlc init
```
and confirming `.sdlc/memory/index.md`, `modules.md`, and `runbook.md` contain real, repo-specific content (overview mentions the greeter; modules list `src/index.js`/`src/greet.js`; runbook shows the npm scripts). This step needs a live Claude Code session and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M2 slice):** Phase 0 investigate → inline explorer fan-out ✓ (Tasks 1, 3); extract → `mergeFindings` ✓ (Task 2); persist → `renderMemory`/`writeMemory` writing the 7 memory files ✓ (Task 2); optional graph index → best-effort note ✓ (Task 3 Step 5); wired into `/sdlc init` + `memory-refresh` ✓ (Task 4); portable, no Workflow-tool dep ✓. Fixtures for dogfooding ✓ (Task 5).
- **Placeholders:** none — all files have complete content; `{{...}}`-style tokens are not used here. `_Not determined during Phase 0._` is a deliberate runtime placeholder for empty memory sections, asserted by a test.
- **Type consistency:** `mergeFindings(slices)`, `renderMemory(findings)`, `writeMemory(projectRoot, findings)` used identically across the impl, tests, and the CLI. The findings schema keys match between `agents/explorer.md`, the merge logic, and the renderers (`overview`, `stack`, `architecture.{summary,boundaries,components}`, `modules[].{path,purpose}`, `conventions`, `glossary[].{term,definition}`, `runbook.{build,test,run,notes}`, `risks[].{area,note}`). `write-memory.mjs` imports `sdlcPaths` from `./lib/paths.mjs` (M1).
- **Testability boundary is explicit:** deterministic merge/render/write is unit-tested (Task 2) and smoke-tested with canned slices (Task 5 Step 3); the LLM investigation is a documented manual acceptance (Task 5 Step 6) — not silently skipped.
```
