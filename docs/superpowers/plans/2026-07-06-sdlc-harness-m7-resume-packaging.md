# SDLC Harness — Milestone 7: Resume + Packaging (the finisher) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the harness: implement **`/sdlc resume`** (re-enter a paused task at its saved phase), make it **installable** via both `npx skills add <repo>` and the Claude Code plugin marketplace (`.claude-plugin/{plugin,marketplace}.json`), refresh the **README**, and close the small logged cleanups.

**Architecture:** A deterministic, unit-tested `scripts/resume.mjs` lists resumable tasks (phase ≠ done) and prints a task's state; `SKILL.md`'s `resume` sub-command uses it to jump back into the right phase guide. Packaging adds two JSON manifests at the repo root: `.claude-plugin/plugin.json` (the whole repo is one plugin, `sdlc-harness`, bundling `skills/sdlc`) and `.claude-plugin/marketplace.json` (a one-plugin catalog with `source: "."`). `npx skills` keeps working via auto-discovery of `skills/sdlc/SKILL.md`. Two cleanups: harden `frontmatter.mjs` against `$` in values; align the `review.md` template header with `renderReview`.

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), JSON manifests, Markdown. No third-party deps.

**Depends on (on `main`):** `scripts/status.mjs` (`listTasks`), `scripts/set-state.mjs` (`setPhase`, used in tests), `lib/state.mjs` (`readState`), `lib/paths.mjs` (`sdlcPaths`), `scripts/new-task.mjs`/`scaffold.mjs`, `SKILL.md` (has a `resume` stub), `templates/review.md`, `scripts/lib/frontmatter.mjs`, and the full phase-guide set.

**Scope of this milestone (final):**
- In: `scripts/resume.mjs` (`resumableTasks` + CLI) + tests; wire `SKILL.md` `resume`; `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`; README rewrite; cleanups (frontmatter `$`-safe + a test; `review.md` template header).
- Out: nothing deferred beyond this — M7 completes the roadmap.

**Testability boundary (no silent caps):** `resumableTasks` and the frontmatter cleanup are deterministic and unit-tested. Actual plugin-marketplace install and `npx skills add` are environment actions validated by **manual acceptance** (documented). JSON manifests are validated for syntax/shape in a smoke.

## File Structure
```
skills/sdlc/
  scripts/
    resume.mjs           # NEW: resumableTasks + CLI (list resumable / print a task's state)
    resume.test.mjs      # NEW
    lib/frontmatter.mjs  # MODIFIED: $-safe replacement
    lib/frontmatter.test.mjs # MODIFIED: add a $-in-value test
  templates/
    review.md            # MODIFIED: header `fix status` -> `fix` (match renderReview)
  SKILL.md               # MODIFIED: real `resume` sub-command
.claude-plugin/
  plugin.json            # NEW
  marketplace.json       # NEW
README.md                # MODIFIED: full lifecycle + resume + install (npx skills + plugin marketplace)
```

---

### Task 1: `scripts/resume.mjs` — list resumable tasks + read a task's state

**Files:**
- Create: `skills/sdlc/scripts/resume.mjs`
- Test: `skills/sdlc/scripts/resume.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/resume.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { setPhase } from './set-state.mjs';
import { resumableTasks } from './resume.mjs';

const tmps = [];
function mktmp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-res-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return root;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

test('resumableTasks is empty for a fresh repo', () => {
  assert.deepEqual(resumableTasks(mktmp()), []);
});

test('resumableTasks excludes done tasks and keeps active ones', () => {
  const root = mktmp();
  const a = createTask(root, { title: 'task one', type: 'bug', date: new Date(2026, 6, 6) });
  const b = createTask(root, { title: 'task two', type: 'bug', date: new Date(2026, 6, 6) });
  setPhase(a.taskDir, 'done');
  const r = resumableTasks(root);
  assert.equal(r.length, 1);
  assert.equal(r[0].task, b.taskId);
  assert.notEqual(r[0].phase, 'done');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/resume.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/resume.mjs`:

```js
import path from 'node:path';
import { readState } from './lib/state.mjs';
import { sdlcPaths } from './lib/paths.mjs';
import { listTasks } from './status.mjs';

export function resumableTasks(projectRoot) {
  return listTasks(projectRoot).filter((t) => t.phase !== 'done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [projectRoot = process.cwd(), taskId] = process.argv.slice(2);
  if (taskId) {
    const { tasksDir } = sdlcPaths(projectRoot);
    console.log(JSON.stringify(readState(path.join(tasksDir, taskId))));
  } else {
    const tasks = resumableTasks(projectRoot);
    if (!tasks.length) {
      console.log('No resumable tasks (all done, or none started).');
    } else {
      for (const t of tasks) console.log(`${t.task}  phase=${t.phase}`);
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/resume.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/resume.mjs skills/sdlc/scripts/resume.test.mjs
git commit -m "feat: resume helper (list resumable tasks + read task state)"
```

---

### Task 2: Wire the real `/sdlc resume` sub-command

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace the `### resume` section.** Find this EXACT block:

```
### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.
```

Replace with:

```
### resume
Resume a paused task from its saved state.

1. Determine the task: if the user gave `<YYYYMMDD>/<slug>`, use it; otherwise run
   `node "<SKILL_DIR>/scripts/resume.mjs" "$(pwd)"` to list resumable tasks (phase ≠ done)
   and pick one (ask the user if there are several).
2. Read its state: `node "<SKILL_DIR>/scripts/resume.mjs" "$(pwd)" "<taskId>"` (prints
   `state.json`); note the current `phase`.
3. Recover context: read the task's `progress.md` (and `spec.md`) under
   `.sdlc/tasks/<taskId>/`.
4. Re-enter that phase by following its guide (passing the task folder):
   `intake`→`phases/intake.md`, `spec_plan`→`phases/spec-plan.md`,
   `implement`→`phases/implement.md`, `test`→`phases/test.md`,
   `review`→`phases/review.md`, `ship`→`phases/ship.md`. If `phase` is `done`, tell the
   user the task is already complete.
5. Continue the lifecycle from there.
```

- [ ] **Step 2: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['### resume','resume.mjs','phases/ship.md']){if(!s.includes(t))throw new Error('missing: '+t)}if(/Not implemented in this milestone/.test(s))throw new Error('old resume stub still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: implement /sdlc resume (re-enter a paused task at its phase)"
```

---

### Task 3: Packaging — plugin + marketplace manifests

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Create `.claude-plugin/plugin.json`** with exactly:

```json
{
  "name": "sdlc-harness",
  "description": "A portable, gated software development life cycle for AI coding agents: understand the codebase, then run tasks through intake, spec & plan, implement, test, review, and ship.",
  "version": "0.1.0",
  "author": { "name": "gtgsoft" },
  "keywords": ["sdlc", "workflow", "agent", "review", "lifecycle", "code-review"]
}
```

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`** with exactly:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "gtgsoft",
  "owner": { "name": "gtgsoft" },
  "plugins": [
    {
      "name": "sdlc-harness",
      "source": ".",
      "description": "Portable gated SDLC for AI coding agents (understand -> intake -> spec&plan -> implement -> test -> review -> ship)."
    }
  ]
}
```

- [ ] **Step 3: Validate JSON syntax + shape**

Run:
```bash
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('.claude-plugin/plugin.json','utf8'));const m=JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json','utf8'));if(p.name!=='sdlc-harness')throw new Error('plugin name');if(!Array.isArray(m.plugins)||m.plugins[0].source!=='.')throw new Error('marketplace plugins/source');if(!m.owner||!m.name)throw new Error('marketplace owner/name');console.log('manifests OK')"
```
Expected: prints `manifests OK`.

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat: package as a Claude Code plugin + marketplace (installable via npx skills or /plugin)"
```

---

### Task 4: README — full lifecycle + resume + install

**Files:**
- Modify: `README.md` (overwrite with the content below)

- [ ] **Step 1: Overwrite `README.md`** with exactly:

```markdown
# SDLC Harness

A portable, gated **software development life cycle for AI coding agents**, shipped as a
single Claude Code skill (`sdlc`). It first **understands your codebase** (Project Memory),
then drives each task through a repeatable, human-gated lifecycle.

## Lifecycle

```
/sdlc init         Phase 0 — investigate the repo -> .sdlc/memory/ (Project Memory)

/sdlc task "..."   Intake & Clarify
                     -> Spec & Plan        [gate: approve plan]
                     -> Implement          (subagent-driven | inline)
                     -> Test               (loops back to Implement until green)
                     -> Review             [gate: approve to ship]  (fan-out + adversarial verify)
                     -> Ship               (commit/PR, refresh memory) -> done
```

Tracks scale the loop by work size: **full** (feature), **fast** (bug/chore), **hotfix**
(urgent — lighter gates, but a regression test is never skipped).

## Requirements
- Claude Code
- Node.js ≥ 18 (used by the harness's bundled scripts)

## Install

Via the skills CLI (recommended):
```bash
npx skills add <owner>/<repo>
```

Or as a Claude Code plugin marketplace:
```
/plugin marketplace add <owner>/<repo>
/plugin install sdlc-harness@gtgsoft
```

Restart your Claude Code session so the `sdlc` skill is picked up.

## Use
- `/sdlc init` — investigate the codebase and build Project Memory in `.sdlc/memory/`.
- `/sdlc task "<request>"` — take an issue/bug/feature from intake to shipped.
- `/sdlc status` — list tasks and their phase/gate state.
- `/sdlc resume [<YYYYMMDD>/<slug>]` — resume a paused task at its saved phase.
- `/sdlc memory-refresh` — re-run Phase 0 to refresh Project Memory.

Configuration lives in `.sdlc/config.yml` (build/test commands, gate strictness,
track defaults, loop limits, review dimensions, ship mode).

## Development
```bash
npm test   # runs the Node unit tests for the bundled scripts
```
```

- [ ] **Step 2: Sanity-check README mentions the key commands**

Run: `node -e "const s=require('fs').readFileSync('README.md','utf8');for(const t of ['npx skills add','/plugin marketplace add','/sdlc init','/sdlc resume','/sdlc memory-refresh']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('README OK')"`
Expected: prints `README OK`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README — full lifecycle, resume, and install (npx skills + plugin marketplace)"
```

---

### Task 5: Cleanups — frontmatter `$`-safe + review.md template header

**Files:**
- Modify: `skills/sdlc/scripts/lib/frontmatter.mjs`
- Modify: `skills/sdlc/scripts/lib/frontmatter.test.mjs`
- Modify: `skills/sdlc/templates/review.md`

- [ ] **Step 1: Make `setFrontMatterField` `$`-safe.** In `skills/sdlc/scripts/lib/frontmatter.mjs`, find:

```js
  const newBlock = re.test(block)
    ? block.replace(re, `${key}: ${value}`)
    : `${block}\n${key}: ${value}`;
```

Replace with (function replacer so `$` in `value` is inserted literally):

```js
  const line = `${key}: ${value}`;
  const newBlock = re.test(block)
    ? block.replace(re, () => line)
    : `${block}\n${line}`;
```

- [ ] **Step 2: Add a `$`-value test.** In `skills/sdlc/scripts/lib/frontmatter.test.mjs`, add this test after the existing tests:

```js
test('setFrontMatterField inserts a value containing $ literally', () => {
  const out = setFrontMatterField(md, 'status', 'a$1b');
  assert.match(out, /^status: a\$1b$/m);
});
```

- [ ] **Step 3: Align the `review.md` template header with the renderer.** In
`skills/sdlc/templates/review.md`, find:

```
| dimension | location | severity | claim | verdict | fix status |
|-----------|----------|----------|-------|---------|------------|
```

Replace with:

```
| dimension | location | severity | claim | verdict | fix |
|-----------|----------|----------|-------|---------|-----|
```

- [ ] **Step 4: Run the affected tests**

Run: `node --test skills/sdlc/scripts/lib/frontmatter.test.mjs`
Expected: PASS (5 tests — the original 4 plus the new `$` test).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/frontmatter.mjs skills/sdlc/scripts/lib/frontmatter.test.mjs skills/sdlc/templates/review.md
git commit -m "fix: frontmatter \$-safe replacement; align review.md template header"
```

---

### Task 6: Full suite + resume smoke + manual acceptance

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all prior tests plus the 2 new `resume` tests and the 1 new `frontmatter` test pass, `fail 0` (52 total). Paste the totals line. If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Resume smoke** (agent-free)

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo >/dev/null
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Add CSV export" feature >/dev/null)
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug >/dev/null)
# advance one to review, mark the other done
A=$(ls -d .tmp-test/repo/.sdlc/tasks/*/add-csv-export)
B=$(ls -d .tmp-test/repo/.sdlc/tasks/*/fix-login-timeout)
node skills/sdlc/scripts/set-state.mjs "$A" phase review >/dev/null
node skills/sdlc/scripts/set-state.mjs "$B" phase done >/dev/null
echo "--- resumable list ---"
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/resume.mjs "$(pwd)")
echo "--- resume one task's state ---"
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/resume.mjs "$(pwd)" "$(ls .sdlc/tasks)/add-csv-export" | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8'));if(s.phase!=='review')throw new Error('phase '+s.phase);console.log('resume state OK: phase='+s.phase)")
rm -rf .tmp-test
```
Expected: the resumable list shows only `add-csv-export  phase=review` (the `done` one excluded), and `resume state OK: phase=review`.

- [ ] **Step 3: Confirm clean**

Run: `git status --short` (expect empty; `.tmp-test/` is gitignored).

- [ ] **Step 4: Manual live acceptance (document, do not automate)**

Record in the report that install + resume are validated by a human:
- `npx skills add <owner>/<repo>` (or `/plugin marketplace add <owner>/<repo>` then
  `/plugin install sdlc-harness@gtgsoft`) installs the `sdlc` skill; restart; `/sdlc` is available.
- Start a task, stop mid-phase, then `/sdlc resume` re-enters at the saved phase using
  `state.json` + `progress.md`.
These need a live Claude Code session and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M7 slice):** `/sdlc resume` implemented (resume.mjs + wired guide) ✓ (Tasks 1–2); `npx skills` + plugin-marketplace install via `.claude-plugin/{plugin,marketplace}.json` ✓ (Task 3); README covers full lifecycle + resume + both install paths ✓ (Task 4); logged cleanups closed (frontmatter `$`-safe + review.md header) ✓ (Task 5). Resolves the roadmap's final milestone.
- **Placeholders:** none — all files complete. `<owner>/<repo>` in README/manifests is a user-substituted install target (documented), not a code placeholder. `<SKILL_DIR>`/`<taskDir>` per prior guides.
- **Type consistency:** `resumableTasks(projectRoot)` reuses `listTasks` (status.mjs, M1) and filters `phase !== 'done'` (phase values from transition.mjs); resume CLI reads state via `readState`/`sdlcPaths`. `setPhase` (set-state.mjs) used in tests to mark done. Manifest field names (`name`,`owner`,`plugins[].source`,`plugin.json` `name`/`version`) match the Claude Code marketplace schema.
- **Testability boundary explicit:** `resumableTasks` + frontmatter `$`-safety unit-tested (Tasks 1, 5) + resume smoke (Task 6 Step 2); actual install + live resume are documented manual acceptance (Task 6 Step 4).
```
