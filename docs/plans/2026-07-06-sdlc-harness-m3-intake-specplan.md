# SDLC Harness — Milestone 3: Inner loop phases 1–2 (Intake & Clarify + Spec & Plan + spec gate) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/sdlc task` walk a new task through **Intake & Clarify** (interactive dialogue with the developer) and **Spec & Plan** (fill the plan, pass the spec gate), with deterministic, unit-tested phase/gate state transitions.

**Architecture:** Two new phase guides (`phases/intake.md`, `phases/spec-plan.md`) that the *conductor* (the live session) follows — these phases are interactive/human, not subagents. The state changes they trigger are deterministic and unit-tested: a `lib/transition.mjs` (phase order), a `lib/frontmatter.mjs` (edit `spec.md` front-matter), and a `scripts/set-state.mjs` (setPhase/advance/setGate updating both `state.json` and `spec.md` front-matter, with a CLI). `SKILL.md`'s `task` sub-command is wired to run Intake → Spec & Plan and stop at the gate. Everything honors the index-first, lazy memory rule (spec §5.1).

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), Markdown phase guides. No third-party deps.

**Depends on (on `main`):** `lib/paths.mjs`, `lib/state.mjs` (`readState`/`writeState`/`newTaskState`), `scripts/new-task.mjs` (`createTask`), `scaffold.mjs`, the `spec.md` template with front-matter (`status`, `gate_spec_plan`, `gate_review`), and `SKILL.md`.

**Scope of this milestone:**
- In: `lib/transition.mjs`; `lib/frontmatter.mjs`; `scripts/set-state.mjs` + tests; `phases/intake.md`; `phases/spec-plan.md`; wire `/sdlc task` to run Intake → Spec & Plan → spec gate; track-scaled behavior in the guides.
- Out (later milestones): Implement, Test, Review, Ship phases; the review workflow; resume mid-loop; enforcement beyond what the guides + state fields express.

**Testability boundary (no silent caps):** The interactive Intake dialogue and the human spec gate are conductor/human behavior — validated by **manual live acceptance** (run `/sdlc task` on `fixtures/sample-repo`). All state transitions (phase advance, gate set, front-matter edits) are deterministic and unit-tested.

## Phase order (canonical)
`intake → spec_plan → implement → test → review → ship → done`

## File Structure

```
skills/sdlc/
  scripts/
    lib/
      transition.mjs        # NEW: PHASES + nextPhase
      transition.test.mjs   # NEW
      frontmatter.mjs       # NEW: setFrontMatterField
      frontmatter.test.mjs  # NEW
    set-state.mjs           # NEW: setPhase / advance / setGate + CLI
    set-state.test.mjs      # NEW
  phases/
    intake.md               # NEW
    spec-plan.md            # NEW
  SKILL.md                  # MODIFIED: task runs Intake → Spec & Plan → gate
```

---

### Task 1: `lib/transition.mjs` — canonical phase order

**Files:**
- Create: `skills/sdlc/scripts/lib/transition.mjs`
- Test: `skills/sdlc/scripts/lib/transition.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/lib/transition.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, nextPhase } from './transition.mjs';

test('PHASES is the canonical ordered lifecycle', () => {
  assert.deepEqual(PHASES, ['intake', 'spec_plan', 'implement', 'test', 'review', 'ship', 'done']);
});

test('nextPhase returns the following phase', () => {
  assert.equal(nextPhase('intake'), 'spec_plan');
  assert.equal(nextPhase('spec_plan'), 'implement');
  assert.equal(nextPhase('review'), 'ship');
});

test('nextPhase caps at done', () => {
  assert.equal(nextPhase('ship'), 'done');
  assert.equal(nextPhase('done'), 'done');
});

test('nextPhase throws on an unknown phase', () => {
  assert.throws(() => nextPhase('bogus'), /unknown phase/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/lib/transition.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/lib/transition.mjs`:

```js
export const PHASES = ['intake', 'spec_plan', 'implement', 'test', 'review', 'ship', 'done'];

export function nextPhase(phase) {
  const i = PHASES.indexOf(phase);
  if (i === -1) throw new Error(`unknown phase: ${phase}`);
  return PHASES[Math.min(i + 1, PHASES.length - 1)];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/lib/transition.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/transition.mjs skills/sdlc/scripts/lib/transition.test.mjs
git commit -m "feat: canonical phase order + nextPhase"
```

---

### Task 2: `lib/frontmatter.mjs` — edit YAML front-matter fields

**Files:**
- Create: `skills/sdlc/scripts/lib/frontmatter.mjs`
- Test: `skills/sdlc/scripts/lib/frontmatter.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/lib/frontmatter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setFrontMatterField } from './frontmatter.mjs';

const md = `---
id: 20260706/x
status: intake          # intake | spec_plan | ...
gate_spec_plan: pending # pending | approved
---

# body stays
`;

test('replaces an existing field and drops its trailing comment', () => {
  const out = setFrontMatterField(md, 'status', 'implement');
  assert.match(out, /^status: implement$/m);
  assert.doesNotMatch(out, /status: intake/);
  assert.match(out, /# body stays/); // body untouched
});

test('replaces only within the front-matter block', () => {
  const out = setFrontMatterField(md, 'gate_spec_plan', 'approved');
  assert.match(out, /^gate_spec_plan: approved$/m);
});

test('inserts a missing field into the front-matter', () => {
  const out = setFrontMatterField(md, 'track', 'fast');
  assert.match(out, /^track: fast$/m);
  assert.match(out, /^id: 20260706\/x$/m); // existing fields preserved
});

test('throws when there is no front-matter', () => {
  assert.throws(() => setFrontMatterField('no front-matter here', 'x', 'y'), /front-matter/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/lib/frontmatter.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/lib/frontmatter.mjs`:

```js
// Minimal YAML front-matter field editor for the harness's own task files.
// Operates only inside the leading `---` ... `---` block.
export function setFrontMatterField(md, key, value) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('no front-matter block found');
  const block = m[1];
  const re = new RegExp(`^(${key}:)[^\\n]*$`, 'm');
  const newBlock = re.test(block)
    ? block.replace(re, `${key}: ${value}`)
    : `${block}\n${key}: ${value}`;
  return md.replace(block, newBlock);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/lib/frontmatter.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/lib/frontmatter.mjs skills/sdlc/scripts/lib/frontmatter.test.mjs
git commit -m "feat: front-matter field editor for task files"
```

---

### Task 3: `scripts/set-state.mjs` — phase/gate transitions

Updates both `state.json` and `spec.md` front-matter atomically per call. Follow TDD.

**Files:**
- Create: `skills/sdlc/scripts/set-state.mjs`
- Test: `skills/sdlc/scripts/set-state.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/set-state.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { setPhase, advance, setGate } from './set-state.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-set-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

function state(taskDir) { return JSON.parse(fs.readFileSync(path.join(taskDir, 'state.json'), 'utf8')); }
function spec(taskDir) { return fs.readFileSync(path.join(taskDir, 'spec.md'), 'utf8'); }

test('setPhase updates state.json and spec.md status', () => {
  const taskDir = newTask();
  setPhase(taskDir, 'implement');
  assert.equal(state(taskDir).phase, 'implement');
  assert.match(spec(taskDir), /^status: implement$/m);
});

test('advance moves to the next phase', () => {
  const taskDir = newTask();               // starts at intake
  assert.equal(advance(taskDir), 'spec_plan');
  assert.equal(state(taskDir).phase, 'spec_plan');
});

test('setGate updates the gate in state.json and spec.md', () => {
  const taskDir = newTask();
  setGate(taskDir, 'spec_plan', 'approved');
  assert.equal(state(taskDir).gates.spec_plan, 'approved');
  assert.match(spec(taskDir), /^gate_spec_plan: approved$/m);
});

test('setGate rejects an invalid gate or value', () => {
  const taskDir = newTask();
  assert.throws(() => setGate(taskDir, 'nope', 'approved'), /invalid gate/);
  assert.throws(() => setGate(taskDir, 'review', 'maybe'), /invalid gate value/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/set-state.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/set-state.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { readState, writeState } from './lib/state.mjs';
import { nextPhase } from './lib/transition.mjs';
import { setFrontMatterField } from './lib/frontmatter.mjs';

const GATES = ['spec_plan', 'review'];
const GATE_VALUES = ['pending', 'approved'];

function updateSpecField(taskDir, key, value) {
  const p = path.join(taskDir, 'spec.md');
  if (fs.existsSync(p)) {
    fs.writeFileSync(p, setFrontMatterField(fs.readFileSync(p, 'utf8'), key, value));
  }
}

export function setPhase(taskDir, phase) {
  const s = readState(taskDir);
  s.phase = phase;
  writeState(taskDir, s);
  updateSpecField(taskDir, 'status', phase);
  return phase;
}

export function advance(taskDir) {
  const s = readState(taskDir);
  return setPhase(taskDir, nextPhase(s.phase));
}

export function setGate(taskDir, gate, value) {
  if (!GATES.includes(gate)) throw new Error(`invalid gate: ${gate} (expected ${GATES.join('|')})`);
  if (!GATE_VALUES.includes(value)) throw new Error(`invalid gate value: ${value} (expected ${GATE_VALUES.join('|')})`);
  const s = readState(taskDir);
  s.gates = { ...s.gates, [gate]: value };
  writeState(taskDir, s);
  updateSpecField(taskDir, `gate_${gate}`, value);
  return s.gates;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [taskDir, cmd, a, b] = process.argv.slice(2);
  if (!taskDir || !cmd) {
    console.error('usage: node set-state.mjs <taskDir> <phase <name> | advance | gate <gate> <value>>');
    process.exit(1);
  }
  if (cmd === 'phase') setPhase(taskDir, a);
  else if (cmd === 'advance') advance(taskDir);
  else if (cmd === 'gate') setGate(taskDir, a, b);
  else { console.error(`unknown command: ${cmd}`); process.exit(1); }
  console.log(JSON.stringify(readState(taskDir)));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/set-state.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/set-state.mjs skills/sdlc/scripts/set-state.test.mjs
git commit -m "feat: phase/gate state transitions (state.json + spec.md front-matter)"
```

---

### Task 4: `phases/intake.md` — Intake & Clarify guide

**Files:**
- Create: `skills/sdlc/phases/intake.md`

- [ ] **Step 1: Create `skills/sdlc/phases/intake.md`** with exactly:

```markdown
# Phase 1 — Intake & Clarify

Goal: turn a raw request into an agreed understanding, through dialogue with the
developer. This phase is INTERACTIVE — run by the conductor in the live session,
NOT a subagent. Scaled by the task's `track` (see `state.json` / `spec.md` front-matter).
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): read `.sdlc/memory/index.md` for orientation; load a
specific memory file only if it helps clarify the request (e.g., `modules.md` to
locate the affected area). Do NOT bulk-load `.sdlc/memory/`.

## Steps
1. Read the task's `spec.md` and `state.json`. Confirm phase is `intake`.
2. Analyze the request: restate it in one line and list what is ambiguous or unstated.
3. Ask the developer clarifying questions — scaled by `track`:
   - `full`: brainstorm thoroughly — requirements, approach, acceptance criteria, edge cases.
   - `fast`: 1–3 targeted questions only.
   - `hotfix`: confirm the bug and how to reproduce it; skip open-ended design questions.
   Ask one focused question at a time; prefer concrete options over open prompts.
4. When requirement and approach are agreed, record them into `spec.md` **Part 1 — Spec**
   (Summary, Context, Problem/Goal, Requirements, Acceptance criteria, Out of scope,
   Assumptions & resolved questions). Keep acceptance criteria testable.
5. Append a dated entry to `progress.md` capturing the intake outcome and key decisions.
6. Advance to Spec & Plan:
   `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `intake` → `spec_plan`), then follow `<SKILL_DIR>/phases/spec-plan.md`.

## Notes
- This phase is a conversation — do not guess when you can ask.
- Lock decisions under "Assumptions & resolved questions" so they aren't re-litigated later.
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/intake.md','utf8');for(const t of ['Intake & Clarify','index.md','track','set-state.mjs','spec-plan.md','Part 1']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('intake.md OK')"`
Expected: prints `intake.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/intake.md
git commit -m "feat: Intake & Clarify phase guide"
```

---

### Task 5: `phases/spec-plan.md` — Spec & Plan guide + spec gate

**Files:**
- Create: `skills/sdlc/phases/spec-plan.md`

- [ ] **Step 1: Create `skills/sdlc/phases/spec-plan.md`** with exactly:

```markdown
# Phase 2 — Spec & Plan

Goal: produce the execution plan and pass the spec gate. Builds on the agreed
understanding from Intake. Scaled by `track`. `<SKILL_DIR>` is this skill's base
directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): read `.sdlc/memory/index.md`, then load `modules.md`
and `risks.md` for the affected areas to ground the plan; load `conventions.md` if
it informs the approach. Load only what you need.

## Steps
1. Confirm `spec.md` Part 1 (Spec) is filled from Intake and phase is `spec_plan`.
2. Fill `spec.md` **Part 2 — Plan**: Approach (+ why), Affected files & modules
   (from `modules.md` / `risks.md`), ordered Steps mapped to files, Test plan
   (each acceptance criterion → a test), Risks & rollback. Scale detail by `track`:
   - `hotfix`: a one-line approach + the regression test that proves the fix.
   - `fast`: summary approach + steps + test plan.
   - `full`: the complete plan.
3. Append a dated entry to `progress.md`.
4. **Spec gate** — read `gates.spec_plan` from `.sdlc/config.yml`:
   - `hard` (default) AND track is not `hotfix`: present a concise summary to the
     developer — Problem/Goal, Acceptance criteria, and the Plan steps — and ask
     them to APPROVE or request changes. Wait for explicit approval; revise and
     re-present if changes are requested.
   - `hotfix` track, or `soft`/`off` config: do not stop; record the plan and proceed.
5. On approval (or when the gate is skipped), record it and advance:
   `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" gate spec_plan approved`
   then `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `spec_plan` → `implement`).
6. Report that the plan is approved and the task is at phase `implement`. Implement,
   Test, Review, and Ship arrive in later milestones — stop here for now.

## Notes
- The gate reviews the whole `spec.md` (Spec + Plan) at once.
- Never advance past a `hard` spec gate without explicit approval (unless track is `hotfix`).
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/spec-plan.md','utf8');for(const t of ['Spec & Plan','Spec gate','gates.spec_plan','set-state.mjs','Part 2','modules.md']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('spec-plan.md OK')"`
Expected: prints `spec-plan.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/spec-plan.md
git commit -m "feat: Spec & Plan phase guide with spec gate"
```

---

### Task 6: Wire `/sdlc task` to run Intake → Spec & Plan

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace step 5 of the `### task` section.** Find this EXACT block:

```
5. Tell the user the task skeleton (`spec.md`, `progress.md`, `review.md`,
   `state.json`) is ready at phase `intake`. Driving the interactive phases
   (Intake → Spec & Plan → Implement → Test → Review → Ship, scaled by track)
   is added in later milestones.
```

Replace with:

```
5. The created task folder is `<taskDir>` (`.sdlc/tasks/<YYYYMMDD>/<slug>/`), at phase `intake`.
6. Run **Phase 1 — Intake & Clarify**: follow `<SKILL_DIR>/phases/intake.md` (pass
   `<taskDir>`). This is an interactive dialogue with the developer.
7. Run **Phase 2 — Spec & Plan**: follow `<SKILL_DIR>/phases/spec-plan.md` (pass
   `<taskDir>`), ending at the spec gate.
8. After the gate is approved the task is at phase `implement`. Implement → Test →
   Review → Ship arrive in later milestones; stop there for now.
```

- [ ] **Step 2: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['phases/intake.md','phases/spec-plan.md','### task','### init','### memory-refresh']){if(!s.includes(t))throw new Error('missing: '+t)}if(/Driving the interactive phases/.test(s))throw new Error('old task step 5 still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: wire /sdlc task through Intake and Spec & Plan phases"
```

---

### Task 7: Full suite + manual acceptance

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all prior tests plus the new `transition` (4), `frontmatter` (4), and `set-state` (4) tests pass, `fail 0`. Paste the totals line. If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Deterministic transition smoke** (agent-free)

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo >/dev/null
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug >/dev/null)
TASKDIR=$(ls -d .tmp-test/repo/.sdlc/tasks/*/fix-login-timeout)
node skills/sdlc/scripts/set-state.mjs "$TASKDIR" gate spec_plan approved
node skills/sdlc/scripts/set-state.mjs "$TASKDIR" advance
TD="$TASKDIR" node -e "const fs=require('fs');const d=process.env.TD;const st=JSON.parse(fs.readFileSync(d+'/state.json','utf8'));const sp=fs.readFileSync(d+'/spec.md','utf8');if(st.phase!=='spec_plan')throw new Error('phase '+st.phase);if(st.gates.spec_plan!=='approved')throw new Error('gate');if(!/^gate_spec_plan: approved$/m.test(sp))throw new Error('spec gate field');if(!/^status: spec_plan$/m.test(sp))throw new Error('spec status field');console.log('transition smoke OK')"
rm -rf .tmp-test
```
Expected: `transition smoke OK`. Note: the task was created at `intake`; setting the gate then advancing once moves it to `spec_plan` with the gate approved — this smoke exercises the deterministic transitions only, not the interactive phases.

- [ ] **Step 3: Commit** (if the smoke required any fixups; otherwise nothing to commit)

```bash
git status --short   # expect clean (smoke used gitignored .tmp-test)
```

- [ ] **Step 4: Manual live acceptance (document, do not automate)**

Record in the report that the interactive path is validated by a human running, in a live Claude Code session on a repo with Project Memory:
```
/sdlc task "Add a --loud flag that upper-cases the greeting" feature
```
and confirming: Intake asks clarifying questions; on agreement `spec.md` Part 1 is filled; Spec & Plan fills Part 2 and presents the spec gate; on approval `state.json` shows `phase: implement`, `gates.spec_plan: approved`, and `spec.md` front-matter matches. This needs a live conductor + human and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M3 slice):** Intake & Clarify (interactive, track-scaled, index-first memory) ✓ (Task 4); Spec & Plan filling `spec.md` Part 2 + spec gate ✓ (Task 5); deterministic phase/gate transitions updating `state.json` + `spec.md` front-matter ✓ (Tasks 1–3); `/sdlc task` wired through both phases ✓ (Task 6); lazy memory rule stated in both guides ✓; track scaling (full/fast/hotfix incl. hotfix gate-skip) ✓.
- **Placeholders:** none — all files have complete content. `<SKILL_DIR>`/`<taskDir>` are documented runtime substitutions, consistent with M1/M2 guides.
- **Type consistency:** `PHASES`/`nextPhase` (transition.mjs) consumed by `advance` (set-state.mjs); `setFrontMatterField` (frontmatter.mjs) consumed by set-state's `updateSpecField`; `readState`/`writeState` from M1 `state.mjs`; gate keys `spec_plan`/`review` and front-matter keys `status`/`gate_spec_plan`/`gate_review` match the M1 `spec.md` template and `state.json` shape. `createTask` (M1) used in tests to build a task dir.
- **Testability boundary explicit:** transitions unit-tested (Tasks 1–3) + a deterministic smoke (Task 7 Step 2); interactive Intake + human gate are a documented manual acceptance (Task 7 Step 4).
```
