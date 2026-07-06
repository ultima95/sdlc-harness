# SDLC Harness — Milestone 6: Ship (commit/PR + refresh memory + close the task) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the **Ship** phase — finalize the change (commit, or open a PR per `ship.mode`), update docs, **refresh Project Memory** (the never-stale invariant), append a progress entry, and move the task to `done` — wired as the final step of `/sdlc task`. This completes the per-task lifecycle end-to-end.

**Architecture:** A phase guide (`phases/ship.md`) the conductor follows. The new deterministic, unit-tested piece is `scripts/progress.mjs` (`appendProgress` — appends a dated section to `progress.md`), which Ship uses to record the outcome. Ship reads `ship.mode` and `memory.refresh` from `config.yml`; memory refresh is targeted (update the touched memory files) or a full `/sdlc memory-refresh`. Task closes via `set-state.mjs advance` (ship → done). No Workflow-tool dependency.

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), Markdown guide, `gh` CLI (only when `ship.mode: pr`). No third-party deps.

**Depends on (on `main`):** `scripts/set-state.mjs` (`advance`), `scripts/scaffold.mjs`, `scripts/new-task.mjs` (`createTask`, which seeds `progress.md`), `phases/understand.md` (for full memory refresh), `config.yml` (`ship.mode`, `memory.refresh`), and `SKILL.md` (task flow through Review).

**Scope of this milestone:**
- In: `scripts/progress.mjs` (`appendProgress` + CLI) + tests; `ship.mode` in the config template; `phases/ship.md`; wire `/sdlc task` through Ship → `done`.
- Out (later milestone): M7 — resume/status polish + `npx skills` packaging (`marketplace.json`) + the logged cosmetic follow-ups.

**Testability boundary (no silent caps):** Committing/PR-opening, doc edits, and applying memory updates are conductor/live behavior — validated by **manual live acceptance**. The progress-log append and phase transition are deterministic and unit-tested; a smoke exercises the logger agent-free.

## File Structure
```
skills/sdlc/
  scripts/
    progress.mjs         # NEW: appendProgress(taskDir, phase, note) + CLI
    progress.test.mjs    # NEW
  phases/
    ship.md              # NEW: Ship phase guide (commit/PR + memory refresh + done)
  templates/
    config.yml           # MODIFIED: add ship.mode
  SKILL.md               # MODIFIED: task flow runs Ship after Review → done
```

---

### Task 1: `scripts/progress.mjs` — append a dated progress entry

**Files:**
- Create: `skills/sdlc/scripts/progress.mjs`
- Test: `skills/sdlc/scripts/progress.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/progress.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { appendProgress } from './progress.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-prog-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });
const read = (taskDir) => fs.readFileSync(path.join(taskDir, 'progress.md'), 'utf8');

test('appendProgress appends a dated section without clobbering existing content', () => {
  const taskDir = newTask();
  const before = read(taskDir);
  appendProgress(taskDir, 'implement', 'wrote the code');
  const after = read(taskDir);
  assert.ok(after.startsWith(before), 'existing content preserved (appended, not overwritten)');
  assert.match(after, /## \d{4}-\d{2}-\d{2} — implement/);
  assert.match(after, /- wrote the code/);
});

test('appendProgress adds distinct entries on repeated calls', () => {
  const taskDir = newTask();
  appendProgress(taskDir, 'test', 'ran tests');
  appendProgress(taskDir, 'ship', 'opened PR #12');
  const md = read(taskDir);
  assert.match(md, /— test/);
  assert.match(md, /— ship/);
  assert.match(md, /opened PR #12/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/progress.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/progress.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

export function appendProgress(taskDir, phase, note) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const entry = `\n## ${date} — ${phase}\n- ${note}\n`;
  fs.appendFileSync(path.join(taskDir, 'progress.md'), entry);
  return entry;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [taskDir, phase, ...noteParts] = process.argv.slice(2);
  const note = noteParts.join(' ');
  if (!taskDir || !phase || !note) {
    console.error('usage: node progress.mjs <taskDir> <phase> <note...>');
    process.exit(1);
  }
  appendProgress(taskDir, phase, note);
  console.log('appended progress entry');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/progress.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/progress.mjs skills/sdlc/scripts/progress.test.mjs
git commit -m "feat: progress.md dated-entry logger"
```

---

### Task 2: Add `ship.mode` to the config template

**Files:**
- Modify: `skills/sdlc/templates/config.yml`

- [ ] **Step 1: Add a `ship` block.** Find this EXACT block in `skills/sdlc/templates/config.yml`:

```yaml
review:
  dimensions: [correctness, security, tests, conventions]
  verify: adversarial     # spawn verifiers to refute findings
```

Replace it with:

```yaml
review:
  dimensions: [correctness, security, tests, conventions]
  verify: adversarial     # spawn verifiers to refute findings
ship:
  mode: commit            # commit | pr  (open a PR with gh, or leave commits for the dev)
```

- [ ] **Step 2: Verify the template still scaffolds and stays valid**

Run:
```bash
rm -rf .tmp-test && node skills/sdlc/scripts/scaffold.mjs .tmp-test/cfg >/dev/null && node -e "const s=require('fs').readFileSync('.tmp-test/cfg/.sdlc/config.yml','utf8');if(!/ship:/.test(s))throw new Error('ship block missing');if(!/mode: commit/.test(s))throw new Error('mode missing');console.log('config ship block OK')" && rm -rf .tmp-test
```
Expected: prints `config ship block OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/templates/config.yml
git commit -m "feat: add ship.mode (commit|pr) to config template"
```

---

### Task 3: `phases/ship.md` — Ship phase guide

**Files:**
- Create: `skills/sdlc/phases/ship.md`

- [ ] **Step 1: Create `skills/sdlc/phases/ship.md`** with exactly:

```markdown
# Phase 6 — Ship

Goal: finalize and ship the change, refresh Project Memory, and close the task.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder. Scaled by `track`.

Memory: this phase UPDATES memory (step 4) rather than bulk-reading it.

## Steps
1. Confirm phase is `ship` and the review gate is approved (`gate_review: approved`), or
   the track/config waived it. Ensure tests are green.
2. **Finalize the change.** Make sure all work is committed. Then per `.sdlc/config.yml`
   `ship.mode` (default `commit`):
   - `commit`: leave the commits on the current branch for the developer to merge.
   - `pr`: open a pull request with `gh pr create` — title from the task, body summarizing
     the change and the acceptance criteria. Report the PR URL.
3. **Update docs** if the change affects user-facing docs (README, etc.).
4. **Refresh Project Memory** (invariant — memory must never go stale). Per
   `.sdlc/config.yml` `memory.refresh` (default `on_ship`):
   - `on_ship`: apply targeted, index-first updates to the memory files the change touched
     — adjust entries in `modules.md`, `architecture.md`, `risks.md`, `conventions.md`, or
     `glossary.md` for what actually changed. Don't rewrite everything. For a large or
     structural change, run a full re-index instead: `/sdlc memory-refresh`.
   - `manual`: skip here; the developer runs `/sdlc memory-refresh` when they choose.
5. Record the outcome:
   `node "<SKILL_DIR>/scripts/progress.mjs" "<taskDir>" ship "<what shipped: commit/PR + memory refreshed>"`
6. Close the task: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `ship` → `done`).
7. Report: what shipped (commit or PR URL), which memory files were refreshed, and that the
   task is `done`.

## Notes
- Never ship with unresolved `real` review findings or failing tests.
- The two invariants close here: a test proved the change (Test phase), and Ship refreshed
  Project Memory (step 4).
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/ship.md','utf8');for(const t of ['Phase 6 — Ship','ship.mode','memory.refresh','progress.mjs','set-state.mjs','done','gh pr create']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('ship.md OK')"`
Expected: prints `ship.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/ship.md
git commit -m "feat: Ship phase guide (commit/PR + memory refresh + done)"
```

---

### Task 4: Wire `/sdlc task` through Ship → done

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace step 8 of the `### task` section.** Find this EXACT block:

```
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**
   (`<SKILL_DIR>/phases/implement.md`), **Phase 4 — Test** (`<SKILL_DIR>/phases/test.md`),
   then **Phase 5 — Review** (`<SKILL_DIR>/phases/review.md`), ending at the review gate.
   After the review gate is approved the task is at phase `ship`; Ship arrives in a
   later milestone.
```

Replace with:

```
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**
   (`<SKILL_DIR>/phases/implement.md`), **Phase 4 — Test** (`<SKILL_DIR>/phases/test.md`),
   **Phase 5 — Review** (`<SKILL_DIR>/phases/review.md`, review gate), then
   **Phase 6 — Ship** (`<SKILL_DIR>/phases/ship.md`). Ship commits or opens a PR
   (`ship.mode`), refreshes Project Memory, and moves the task to `done`.
```

- [ ] **Step 2: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['phases/implement.md','phases/test.md','phases/review.md','phases/ship.md','### task']){if(!s.includes(t))throw new Error('missing: '+t)}if(/Ship arrives in a\n   later milestone/.test(s))throw new Error('old step 8 still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: wire /sdlc task through the Ship phase to done"
```

---

### Task 5: Full suite + progress smoke + manual acceptance

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all prior tests plus the 2 new `progress` tests pass, `fail 0` (49 total). Paste the totals line. If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Ship-close smoke** (agent-free — progress append + phase advance to done)

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo >/dev/null
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug >/dev/null)
TASKDIR=$(ls -d .tmp-test/repo/.sdlc/tasks/*/fix-login-timeout)
# drive to ship, then close
node skills/sdlc/scripts/set-state.mjs "$TASKDIR" phase ship >/dev/null
node skills/sdlc/scripts/progress.mjs "$TASKDIR" ship "shipped via commit; memory refreshed"
node skills/sdlc/scripts/set-state.mjs "$TASKDIR" advance >/dev/null
TD="$TASKDIR" node -e "const fs=require('fs');const st=JSON.parse(fs.readFileSync(process.env.TD+'/state.json','utf8'));const pg=fs.readFileSync(process.env.TD+'/progress.md','utf8');const sp=fs.readFileSync(process.env.TD+'/spec.md','utf8');if(st.phase!=='done')throw new Error('phase '+st.phase);if(!/— ship/.test(pg))throw new Error('progress ship entry missing');if(!/^status: done$/m.test(sp))throw new Error('spec status not done');console.log('ship smoke OK')"
rm -rf .tmp-test
```
Expected: `appended progress entry`, then `ship smoke OK`.

- [ ] **Step 3: Confirm clean**

Run: `git status --short` (expect empty; `.tmp-test/` is gitignored).

- [ ] **Step 4: Manual live acceptance (document, do not automate)**

Record in the report that the full Ship path is validated by a human running, in a live
session, a task through Review to Ship — confirming: the change is committed (or a PR is
opened when `ship.mode: pr`); Project Memory is refreshed (touched memory files updated, or
`/sdlc memory-refresh` run); a `ship` entry is appended to `progress.md`; and `state.json`
reaches `phase: done` with `spec.md` `status: done`. Committing/PR/memory edits need a live
session and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M6 slice):** Ship finalizes via `ship.mode` (commit|pr) ✓ (Tasks 2, 3); refreshes Project Memory per `memory.refresh` (targeted or full re-index) ✓ (Task 3); records outcome via `progress.mjs` ✓ (Tasks 1, 3); closes task ship→done ✓ (Task 3 via `set-state advance`); wired into `/sdlc task` ✓ (Task 4). Resolves spec §11's PR-vs-commit question via `ship.mode`.
- **Placeholders:** none — all files complete. `<SKILL_DIR>`/`<taskDir>` are documented runtime substitutions per M1–M5.
- **Type consistency:** `appendProgress(taskDir, phase, note)` (progress.mjs) writes to the `progress.md` seeded by `createTask` (M1); Ship invokes `progress.mjs <taskDir> <phase> <note>`, `set-state.mjs advance` (ship→done — `nextPhase('ship') === 'done'` from M3 transition.mjs). `ship.mode`/`memory.refresh` are real `config.yml` keys (Task 2 adds `ship.mode`).
- **Testability boundary explicit:** progress append + phase advance unit-tested (Task 1) + smoke (Task 5 Step 2); commit/PR/memory-edit are documented manual acceptance (Task 5 Step 4).
```
