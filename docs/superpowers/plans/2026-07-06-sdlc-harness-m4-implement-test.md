# SDLC Harness — Milestone 4: Implement + Test (with the implement⇄test loop) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the **Implement** phase (two modes: subagent-driven [recommended] / inline, delegating plan steps to fresh subagents) and the **Test** phase (run the project's tests; loop back to Implement on failure, bounded by `loops.max_test`), wired into `/sdlc task` after the spec gate.

**Architecture:** Two new phase guides (`phases/implement.md`, `phases/test.md`) followed by the conductor. The one deterministic, unit-tested piece is a bounded-loop counter: `scripts/loop.mjs` (`bumpLoop`/`resetLoop` over `state.json` `loops`). The Test guide bumps the counter on failure and compares it to `loops.max_test` from `config.yml` to decide loop-back vs escalate. `SKILL.md`'s `task` flow is extended to run Implement → Test after the gate. Honors index-first lazy memory (spec §5.1), track scaling (§6.1), and the Implement modes (§6.2).

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), Markdown phase guides. No third-party deps.

**Depends on (on `main`):** `lib/state.mjs` (`readState`/`writeState`), `scripts/set-state.mjs` (`advance`, `setPhase`), `scripts/scaffold.mjs`, `scripts/new-task.mjs` (`createTask`), the `spec.md` template (Part 2 Steps + Test plan), `config.yml` (`project.test`, `loops.max_test`), and `SKILL.md` (task flow through the spec gate).

**Scope of this milestone:**
- In: `scripts/loop.mjs` (`bumpLoop`/`resetLoop` + CLI) + tests; `phases/implement.md` (2 modes); `phases/test.md` (run tests, bounded loop-back); wire `/sdlc task` through Implement → Test.
- Out (later milestones): Review phase + verify workflow (M5); Ship + memory refresh (M6); resume/status polish + packaging (M7).

**Testability boundary (no silent caps):** The Implement work (subagent dispatch / inline coding) and running an arbitrary project's test command are conductor/live behavior — validated by **manual live acceptance** (run a real task on `fixtures/sample-repo`). The loop-counter bookkeeping is deterministic and unit-tested; a smoke exercises it agent-free.

## File Structure

```
skills/sdlc/
  scripts/
    loop.mjs             # NEW: bumpLoop / resetLoop over state.json loops + CLI
    loop.test.mjs        # NEW
  phases/
    implement.md         # NEW: Implement phase (subagent-driven | inline)
    test.md              # NEW: Test phase (run tests; bounded loop-back to implement)
  SKILL.md               # MODIFIED: task flow runs Implement → Test after the gate
```

---

### Task 1: `scripts/loop.mjs` — bounded loop counter

**Files:**
- Create: `skills/sdlc/scripts/loop.mjs`
- Test: `skills/sdlc/scripts/loop.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/loop.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { bumpLoop, resetLoop } from './loop.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-loop-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });
function loops(taskDir) { return JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8')).loops; }

test('bumpLoop increments from 0 and returns the new count', () => {
  const t = newTask();
  assert.equal(bumpLoop(t, 'test'), 1);
  assert.equal(bumpLoop(t, 'test'), 2);
  assert.equal(loops(t).test, 2);
  assert.equal(loops(t).review, 0); // other counter untouched
});

test('resetLoop sets the counter back to 0', () => {
  const t = newTask();
  bumpLoop(t, 'review');
  assert.equal(resetLoop(t, 'review'), 0);
  assert.equal(loops(t).review, 0);
});

test('bumpLoop and resetLoop reject an invalid loop key', () => {
  const t = newTask();
  assert.throws(() => bumpLoop(t, 'nope'), /invalid loop/);
  assert.throws(() => resetLoop(t, 'nope'), /invalid loop/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/loop.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/loop.mjs`:

```js
import { readState, writeState } from './lib/state.mjs';

const LOOP_KEYS = ['test', 'review'];

function assertKey(key) {
  if (!LOOP_KEYS.includes(key)) throw new Error(`invalid loop: ${key} (expected ${LOOP_KEYS.join('|')})`);
}

export function bumpLoop(taskDir, key) {
  assertKey(key);
  const s = readState(taskDir);
  const next = (s.loops?.[key] || 0) + 1;
  s.loops = { ...s.loops, [key]: next };
  writeState(taskDir, s);
  return next;
}

export function resetLoop(taskDir, key) {
  assertKey(key);
  const s = readState(taskDir);
  s.loops = { ...s.loops, [key]: 0 };
  writeState(taskDir, s);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [taskDir, cmd, key] = process.argv.slice(2);
  if (!taskDir || !cmd || !key) {
    console.error('usage: node loop.mjs <taskDir> <bump|reset> <test|review>');
    process.exit(1);
  }
  let n;
  if (cmd === 'bump') n = bumpLoop(taskDir, key);
  else if (cmd === 'reset') n = resetLoop(taskDir, key);
  else { console.error(`unknown command: ${cmd}`); process.exit(1); }
  console.log(`${key} loop = ${n}`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/loop.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/loop.mjs skills/sdlc/scripts/loop.test.mjs
git commit -m "feat: bounded implement/review loop counter"
```

---

### Task 2: `phases/implement.md` — Implement phase (subagent-driven | inline)

**Files:**
- Create: `skills/sdlc/phases/implement.md`

- [ ] **Step 1: Create `skills/sdlc/phases/implement.md`** with exactly:

```markdown
# Phase 3 — Implement

Goal: implement the plan from `spec.md` Part 2. Offers two modes; scaled by `track`.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): read `.sdlc/memory/index.md`; load `conventions.md`
before writing code and `modules.md` / `risks.md` for the touched areas. Load only
what you need.

## Choose a mode
Ask the developer which mode (unless the choice is obvious). Default: subagent-driven.
- **Subagent-driven (recommended)** — delegate each ordered Step in `spec.md` Part 2
  to a FRESH subagent that implements just that step (TDD where sensible, self-review,
  commit). Review each subagent's result before dispatching the next. Best for
  multi-step or larger changes; keeps the conductor's context lean.
- **Inline** — implement the steps directly in this session. Best for tiny changes
  (e.g., a one-line fix) or the `hotfix` track.
Record the chosen mode in `progress.md`.

## Steps
1. Confirm phase is `implement` and `spec.md` Part 2 (Plan) has ordered Steps.
2. For each Step in order:
   - Subagent-driven: dispatch a fresh implementer subagent with the step text, the
     relevant memory context, and the acceptance criterion it serves. Have it write
     code + tests and report; review, and re-dispatch with fixes if needed.
   - Inline: make the change yourself, following `conventions.md`.
   Commit per step (or per logical unit).
3. Append a dated entry to `progress.md` (mode used, steps done, commits made).
4. Advance to Test: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `implement` → `test`), then follow `<SKILL_DIR>/phases/test.md`.

## Notes
- Keep each subagent scoped to ONE step; don't let it wander outside the plan.
- Do not skip the plan's Test plan — the Test phase enforces "a test proves the change".
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/implement.md','utf8');for(const t of ['Implement','Subagent-driven','Inline','index.md','conventions.md','set-state.mjs','test.md']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('implement.md OK')"`
Expected: prints `implement.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/implement.md
git commit -m "feat: Implement phase guide (subagent-driven | inline)"
```

---

### Task 3: `phases/test.md` — Test phase (bounded loop-back)

**Files:**
- Create: `skills/sdlc/phases/test.md`

- [ ] **Step 1: Create `skills/sdlc/phases/test.md`** with exactly:

```markdown
# Phase 4 — Test

Goal: prove the change with tests. Run the project's test command; on failure loop
back to Implement, bounded by `loops.max_test`. `<SKILL_DIR>` is this skill's base
directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): load `runbook.md` for how to run tests if the command
isn't already clear from `.sdlc/config.yml`.

## Steps
1. Confirm phase is `test`. Satisfy the plan's Test plan — author any missing tests
   (each acceptance criterion → a test). For `hotfix`, ensure a regression test that
   reproduces the bug exists and now passes.
2. Run the test command from `.sdlc/config.yml` `project.test`.
3. If tests PASS: append a dated entry to `progress.md`, optionally reset the counter
   (`node "<SKILL_DIR>/scripts/loop.mjs" "<taskDir>" reset test`), then advance to
   Review: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `test` → `review`). Follow the Review phase (added in a later milestone).
4. If tests FAIL:
   - Bump the counter: `node "<SKILL_DIR>/scripts/loop.mjs" "<taskDir>" bump test`
     (prints the new count).
   - Compare it to `loops.max_test` in `.sdlc/config.yml` (default 3):
     - Under the limit: return to Implement — move the phase back with
       `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" phase implement`, feed the
       failures to the implementer to fix, then come back to Test.
     - At or over the limit: STOP. Append the failing output to `progress.md`, leave
       the task at phase `test`, and escalate to the developer.

## Notes
- Never advance to Review with failing tests.
- The counter persists in `state.json` `loops.test`, so the bound holds across resumes.
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/test.md','utf8');for(const t of ['Phase 4 — Test','project.test','loops.max_test','loop.mjs','bump test','phase implement']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('test.md OK')"`
Expected: prints `test.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/test.md
git commit -m "feat: Test phase guide with bounded implement loop-back"
```

---

### Task 4: Wire `/sdlc task` through Implement → Test

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace step 8 of the `### task` section.** Find this EXACT block:

```
8. After the gate is approved the task is at phase `implement`. Implement → Test →
   Review → Ship arrive in later milestones; stop there for now.
```

Replace with:

```
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**:
   follow `<SKILL_DIR>/phases/implement.md` (pass `<taskDir>`), then **Phase 4 — Test**:
   follow `<SKILL_DIR>/phases/test.md`. Review → Ship arrive in later milestones;
   stop at phase `review` for now.
```

- [ ] **Step 2: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['phases/implement.md','phases/test.md','phases/intake.md','phases/spec-plan.md','### task']){if(!s.includes(t))throw new Error('missing: '+t)}if(/Implement → Test →\n   Review → Ship arrive/.test(s))throw new Error('old step 8 still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: wire /sdlc task through Implement and Test phases"
```

---

### Task 5: Full suite + loop smoke + manual acceptance

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all prior tests plus the 3 new `loop` tests pass, `fail 0` (43 total). Paste the totals line. If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Loop-counter smoke** (agent-free)

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo >/dev/null
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug >/dev/null)
TASKDIR=$(ls -d .tmp-test/repo/.sdlc/tasks/*/fix-login-timeout)
node skills/sdlc/scripts/loop.mjs "$TASKDIR" bump test
node skills/sdlc/scripts/loop.mjs "$TASKDIR" bump test
TD="$TASKDIR" node -e "const fs=require('fs');const l=JSON.parse(fs.readFileSync(process.env.TD+'/state.json','utf8')).loops;if(l.test!==2)throw new Error('test loop '+l.test);if(l.review!==0)throw new Error('review loop touched');console.log('loop smoke OK')"
node skills/sdlc/scripts/loop.mjs "$TASKDIR" reset test
TD="$TASKDIR" node -e "const fs=require('fs');const l=JSON.parse(fs.readFileSync(process.env.TD+'/state.json','utf8')).loops;if(l.test!==0)throw new Error('reset failed');console.log('reset smoke OK')"
rm -rf .tmp-test
```
Expected: prints `test loop = 1`, `test loop = 2`, `loop smoke OK`, `test loop = 0`, `reset smoke OK`.

- [ ] **Step 3: Confirm clean**

Run: `git status --short` (expect empty; `.tmp-test/` is gitignored).

- [ ] **Step 4: Manual live acceptance (document, do not automate)**

Record in the report that the full Implement→Test path is validated by a human running, in a live session on a repo with Project Memory and a real `project.test` command, a task through the spec gate and then Implement (choosing a mode) and Test — confirming: mode recorded in `progress.md`; on a deliberately failing test the counter bumps and the phase returns to `implement`; on green the phase advances to `review`. This needs live subagents + a real test command and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M4 slice):** Implement phase with two modes (subagent-driven default, inline; delegate plan steps) per §6.2 ✓ (Task 2); Test phase running `project.test` with bounded implement⇄test loop per §7.5 ✓ (Task 3); deterministic bounded-loop counter ✓ (Task 1); wired into `/sdlc task` ✓ (Task 4); index-first lazy memory + track scaling honored in both guides ✓.
- **Placeholders:** none — all files complete. `<SKILL_DIR>`/`<taskDir>` are documented runtime substitutions per the M1–M3 guides.
- **Type consistency:** `bumpLoop`/`resetLoop` (loop.mjs) operate on `state.json` `loops.{test,review}` matching the M1 `newTaskState` shape; guides invoke `loop.mjs <taskDir> bump|reset test` and `set-state.mjs <taskDir> advance|phase implement` — all real verbs (advance/phase from M3 set-state.mjs; bump/reset from Task 1). `loops.max_test`/`project.test` match the M1 `config.yml` template keys.
- **Testability boundary explicit:** loop counter unit-tested (Task 1) + smoke (Task 5 Step 2); Implement dispatch + real test runs are documented manual acceptance (Task 5 Step 4).
```
