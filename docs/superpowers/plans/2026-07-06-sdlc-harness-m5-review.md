# SDLC Harness — Milestone 5: Review (inline fan-out + adversarial verify + review gate) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the **Review** phase — inline fan-out of `reviewer` subagents (one per dimension), adversarial `verifier` subagents that refute findings, a deterministic report writer, and the **review gate** (loop back to Implement on real findings, else approve-to-ship) — wired into `/sdlc task` after Test.

**Architecture:** A phase guide (`phases/review.md`) the conductor follows: dispatch `reviewer` subagents (roles in `agents/reviewer.md`) per `config.review.dimensions`; adversarially verify each finding with `verifier` subagents (`agents/verifier.md`); the deterministic, unit-tested `scripts/review.mjs` dedupes findings, tallies the verdict (majority-refute rule), and renders `review.md`. Confirmed-`real` findings loop back to Implement (bounded by `loops.max_review` via `loop.mjs`); a clean review hits the review gate (`gates.review`) and advances to Ship. No Workflow-tool dependency (inline Agent fan-out, per spec §8).

**Tech Stack:** Node.js ≥ 18 (ESM, `node --test`), Markdown guides + role prompts. No third-party deps.

**Depends on (on `main`):** `lib/state.mjs` (`readState`), `scripts/set-state.mjs` (`advance`, `phase`, `gate`), `scripts/loop.mjs` (`bumpLoop`), `scaffold.mjs`, `new-task.mjs`, `config.yml` (`review.dimensions`, `review.verify`, `gates.review`, `loops.max_review`), the `review.md` template, and `SKILL.md` (task flow through Test).

**Scope of this milestone:**
- In: `scripts/review.mjs` (`dedupeFindings`/`verdict`/`renderReview`/`writeReview` + CLI) + tests; `agents/reviewer.md`; `agents/verifier.md`; `phases/review.md`; wire `/sdlc task` through Review.
- Out (later milestones): Ship + memory refresh (M6); resume/status polish + packaging (M7).

**Testability boundary (no silent caps):** Reviewer/verifier dispatch is conductor/live behavior — validated by **manual live acceptance**. Dedup, the verdict rule, and report rendering are deterministic and unit-tested; a smoke feeds canned findings through `review.mjs write` agent-free.

## Findings schema
Reviewer output (JSON array): `[{ "dimension": "correctness|security|tests|conventions", "file": "<path>", "line": <number>, "severity": "low|med|high", "claim": "<one line>" }]`
Verifier output (JSON object): `{ "refuted": true|false, "reason": "<one line>" }`
Final finding (after verdict): the reviewer finding plus `"verdict": "real|refuted"`.

## File Structure
```
skills/sdlc/
  scripts/
    review.mjs         # NEW: dedupeFindings / verdict / renderReview / writeReview + CLI
    review.test.mjs    # NEW
  agents/
    reviewer.md        # NEW: per-dimension reviewer role
    verifier.md        # NEW: adversarial verifier role
  phases/
    review.md          # NEW: Review phase guide + review gate
  SKILL.md             # MODIFIED: task flow runs Review after Test
```

---

### Task 1: `scripts/review.mjs` — dedupe, verdict, render, write

**Files:**
- Create: `skills/sdlc/scripts/review.mjs`
- Test: `skills/sdlc/scripts/review.test.mjs`

- [ ] **Step 1: Write the failing tests** — `skills/sdlc/scripts/review.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldSdlc } from './scaffold.mjs';
import { createTask } from './new-task.mjs';
import { dedupeFindings, verdict, renderReview, writeReview } from './review.mjs';

const tmps = [];
function newTask() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-rev-'));
  tmps.push(root);
  scaffoldSdlc(root);
  return createTask(root, { title: 'Fix login', type: 'bug', date: new Date(2026, 6, 6) }).taskDir;
}
afterEach(() => { while (tmps.length) fs.rmSync(tmps.pop(), { recursive: true, force: true }); });

const F = (o) => ({ dimension: 'correctness', file: 'a.js', line: 1, severity: 'high', claim: 'x', ...o });

test('dedupeFindings merges arrays and dedupes by dimension+file+line+claim', () => {
  const out = dedupeFindings([[F({}), F({})], [F({ line: 2 }), F({ claim: 'y' })]]);
  assert.equal(out.length, 3); // the exact duplicate is removed
});

test('verdict applies the adversarial majority rule', () => {
  assert.equal(verdict([{ refuted: true }, { refuted: true }, { refuted: false }]), 'refuted');
  assert.equal(verdict([{ refuted: true }, { refuted: false }, { refuted: false }]), 'real');
  assert.equal(verdict([{ refuted: true }]), 'refuted');
  assert.equal(verdict([{ refuted: false }]), 'real');
  assert.equal(verdict([]), 'real'); // no verifiers -> keep the finding
});

test('renderReview renders a table, or a none-row when empty', () => {
  assert.match(renderReview([]), /_none_/);
  const t = renderReview([F({ verdict: 'real' })]);
  assert.match(t, /\| dimension \| location \|/);
  assert.match(t, /a\.js:1/);
  assert.match(t, /correctness/);
});

test('writeReview writes review.md under the task with the task id header', () => {
  const taskDir = newTask();
  const n = writeReview(taskDir, [F({ verdict: 'real' }), F({ verdict: 'real' })]);
  assert.equal(n, 1); // deduped to one
  const md = fs.readFileSync(path.join(taskDir, 'review.md'), 'utf8');
  assert.match(md, /# Review — 20260706\/fix-login/);
  assert.match(md, /a\.js:1/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test skills/sdlc/scripts/review.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** — `skills/sdlc/scripts/review.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { readState } from './lib/state.mjs';

function key(f) { return `${f.dimension}::${f.file}::${f.line}::${f.claim}`; }

export function dedupeFindings(arrays) {
  const seen = new Set();
  const out = [];
  for (const arr of arrays || []) {
    for (const f of arr || []) {
      if (!f) continue;
      const k = key(f);
      if (!seen.has(k)) { seen.add(k); out.push(f); }
    }
  }
  return out;
}

export function verdict(votes) {
  const v = (votes || []).filter(Boolean);
  if (!v.length) return 'real';
  const refuted = v.filter((x) => x.refuted).length;
  return refuted >= Math.ceil(v.length / 2) ? 'refuted' : 'real';
}

export function renderReview(findings) {
  const header = '| dimension | location | severity | claim | verdict | fix |\n|---|---|---|---|---|---|';
  if (!findings || !findings.length) return `${header}\n| _none_ |  |  |  |  |  |`;
  const rows = findings.map(
    (f) => `| ${f.dimension} | ${f.file}:${f.line} | ${f.severity || ''} | ${f.claim} | ${f.verdict || ''} |  |`,
  );
  return [header, ...rows].join('\n');
}

export function writeReview(taskDir, findings) {
  const deduped = dedupeFindings([findings]);
  let id;
  try { id = readState(taskDir).task; } catch { id = path.basename(taskDir); }
  const content = `# Review — ${id}\n\n${renderReview(deduped)}\n`;
  fs.writeFileSync(path.join(taskDir, 'review.md'), content);
  return deduped.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'write') {
    const [taskDir, findingsFile] = rest;
    if (!taskDir || !findingsFile) { console.error('usage: node review.mjs write <taskDir> <findings.json>'); process.exit(1); }
    const findings = JSON.parse(fs.readFileSync(findingsFile, 'utf8'));
    console.log(`wrote review.md with ${writeReview(taskDir, findings)} finding(s)`);
  } else if (cmd === 'verdict') {
    const [votesFile] = rest;
    if (!votesFile) { console.error('usage: node review.mjs verdict <votes.json>'); process.exit(1); }
    console.log(verdict(JSON.parse(fs.readFileSync(votesFile, 'utf8'))));
  } else {
    console.error('usage: node review.mjs <write <taskDir> <findings.json> | verdict <votes.json>>');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test skills/sdlc/scripts/review.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/sdlc/scripts/review.mjs skills/sdlc/scripts/review.test.mjs
git commit -m "feat: review report helpers (dedupe/verdict/render/write)"
```

---

### Task 2: `agents/reviewer.md` — per-dimension reviewer role

**Files:**
- Create: `skills/sdlc/agents/reviewer.md`

- [ ] **Step 1: Create `skills/sdlc/agents/reviewer.md`** with exactly:

```markdown
# Reviewer (Review-phase subagent)

You review a change for ONE dimension and return STRICT JSON findings. You are read-only.

## Inputs (in your dispatch prompt)
- `repoRoot`, the change under review (a diff range or the task's touched files),
  the task's acceptance criteria, and your `dimension`
  (one of: `correctness`, `security`, `tests`, `conventions`).

## What to do
Examine the change ONLY through your dimension's lens:
- `correctness`: logic bugs, wrong edge cases, broken contracts, off-by-one.
- `security`: injection, missing authz, secrets, unsafe/untrusted input.
- `tests`: missing or weak tests vs. the acceptance criteria.
- `conventions`: violations of `.sdlc/memory/conventions.md`.

## Output — STRICT rules
Return ONLY a JSON array (no prose, no markdown fences). Each finding:
{"dimension":"<your dimension>","file":"<path>","line":<number>,"severity":"low|med|high","claim":"<one-line description>"}
Return `[]` if you find nothing. Be specific; base every claim on code you actually read.
```

- [ ] **Step 2: Verify**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/agents/reviewer.md','utf8');for(const t of ['Reviewer','correctness','security','tests','conventions','STRICT']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('reviewer.md OK')"`
Expected: prints `reviewer.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/agents/reviewer.md
git commit -m "feat: per-dimension reviewer subagent role"
```

---

### Task 3: `agents/verifier.md` — adversarial verifier role

**Files:**
- Create: `skills/sdlc/agents/verifier.md`

- [ ] **Step 1: Create `skills/sdlc/agents/verifier.md`** with exactly:

```markdown
# Verifier (Review-phase subagent)

You are an adversarial verifier. Given ONE review finding, try to REFUTE it by reading
the actual code. Default to `refuted: true` if the finding is vague, unfounded, or you
cannot confirm it from the code. You are read-only.

## Input (in your dispatch prompt)
- `repoRoot`, the finding `{dimension, file, line, severity, claim}`, and the change context.

## What to do
Read the cited code. Decide: is this a REAL issue exactly as described, or not?

## Output — STRICT rules
Return ONLY a JSON object (no prose, no markdown fences):
{"refuted": true|false, "reason": "<one line>"}
- `refuted: true` — the finding is NOT a real issue (or is unconfirmable from the code).
- `refuted: false` — you confirmed it IS a real issue as described.
```

- [ ] **Step 2: Verify**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/agents/verifier.md','utf8');for(const t of ['Verifier','refuted','REFUTE','STRICT']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('verifier.md OK')"`
Expected: prints `verifier.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/agents/verifier.md
git commit -m "feat: adversarial verifier subagent role"
```

---

### Task 4: `phases/review.md` — Review phase guide + review gate

**Files:**
- Create: `skills/sdlc/phases/review.md`

- [ ] **Step 1: Create `skills/sdlc/phases/review.md`** with exactly:

```markdown
# Phase 5 — Review

Goal: find real defects in the change, adversarially verify them, and gate shipping.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder. Scaled by `track`.

Memory (index-first, lazy): load `conventions.md` (for the conventions dimension) and
`risks.md` (for correctness/security) as needed. Load only what you need.

## Steps
1. Confirm phase is `review`. Identify the change under review (the task's commits/diff
   since it started) and the acceptance criteria from `spec.md`.
2. **Fan out reviewers.** For each dimension in `.sdlc/config.yml` `review.dimensions`
   (default: correctness, security, tests, conventions), dispatch a `reviewer` subagent
   (role: `<SKILL_DIR>/agents/reviewer.md`) IN PARALLEL, one per dimension. Collect each
   one's JSON findings array. For `fast`/`hotfix` tracks, a single-pass reviewer is fine.
3. **Dedupe.** Merge all reviewer arrays and dedupe by dimension+file+line+claim (this is
   what `review.mjs` does when it writes the report).
4. **Adversarially verify.** If `review.verify` is `adversarial` (default), for each
   finding dispatch a `verifier` subagent (role: `<SKILL_DIR>/agents/verifier.md`). Decide
   each finding's `verdict` with the majority-refute rule — write the verifier votes to a
   JSON file and run `node "<SKILL_DIR>/scripts/review.mjs" verdict <votes.json>` (prints
   `real` or `refuted`). Keep the `verdict` on each finding.
5. **Write the report.** Put the final findings (each with its `verdict`) in a JSON file and
   run `node "<SKILL_DIR>/scripts/review.mjs" write "<taskDir>" <findings.json>` to write
   `review.md`.
6. **Decide:**
   - **Confirmed `real` findings exist:** bump the loop
     (`node "<SKILL_DIR>/scripts/loop.mjs" "<taskDir>" bump review`) and compare to
     `loops.max_review` (default 2). Under the limit → go back to Implement
     (`node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" phase implement`) to fix them,
     then re-run Test and Review. At/over the limit → STOP and escalate to the developer.
   - **Clean (no `real` findings):** this is the **review gate**. Per `.sdlc/config.yml`
     `gates.review`: `hard` (default) and track not `hotfix` → present the change summary
     and ask the developer to APPROVE to ship. `soft`/`off` or `hotfix` → proceed.
     On approval:
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" gate review approved` then
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance` (phase `review` → `ship`).
7. Report the outcome (looped back to Implement, or gate approved → phase `ship`). Ship
   arrives in a later milestone.

## Notes
- Only verified `real` findings loop back — refuted findings are dropped so plausible-but-wrong
  ones don't churn the loop.
- Never approve the review gate with unfixed `real` findings.
```

- [ ] **Step 2: Verify structure**

Run: `node -e "const s=require('fs').readFileSync('skills/sdlc/phases/review.md','utf8');for(const t of ['Phase 5 — Review','review.dimensions','reviewer.md','verifier.md','review.mjs','loops.max_review','gates.review','phase implement']){if(!s.includes(t))throw new Error('missing: '+t)}console.log('review.md OK')"`
Expected: prints `review.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/phases/review.md
git commit -m "feat: Review phase guide (fan-out + adversarial verify + gate)"
```

---

### Task 5: Wire `/sdlc task` through Review

**Files:**
- Modify: `skills/sdlc/SKILL.md`

- [ ] **Step 1: Replace step 8 of the `### task` section.** Find this EXACT block:

```
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**:
   follow `<SKILL_DIR>/phases/implement.md` (pass `<taskDir>`), then **Phase 4 — Test**:
   follow `<SKILL_DIR>/phases/test.md`. Review → Ship arrive in later milestones;
   stop at phase `review` for now.
```

Replace with:

```
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**
   (`<SKILL_DIR>/phases/implement.md`), **Phase 4 — Test** (`<SKILL_DIR>/phases/test.md`),
   then **Phase 5 — Review** (`<SKILL_DIR>/phases/review.md`), ending at the review gate.
   After the review gate is approved the task is at phase `ship`; Ship arrives in a
   later milestone.
```

- [ ] **Step 2: Verify frontmatter + sections**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('skills/sdlc/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);if(!m)throw new Error('no frontmatter');if(!/\nname:\s*sdlc/.test('\n'+m[1]))throw new Error('missing name');for(const t of ['phases/implement.md','phases/test.md','phases/review.md','### task']){if(!s.includes(t))throw new Error('missing: '+t)}if(/Review → Ship arrive in later milestones/.test(s))throw new Error('old step 8 still present');console.log('SKILL.md OK')"
```
Expected: prints `SKILL.md OK`.

- [ ] **Step 3: Commit**

```bash
git add skills/sdlc/SKILL.md
git commit -m "feat: wire /sdlc task through the Review phase"
```

---

### Task 6: Full suite + review smoke + manual acceptance

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all prior tests plus the 4 new `review` tests pass, `fail 0` (47 total). Paste the totals line. If anything fails, STOP and report BLOCKED.

- [ ] **Step 2: Review-report smoke** (agent-free)

Run:
```bash
rm -rf .tmp-test && mkdir -p .tmp-test/repo
node skills/sdlc/scripts/scaffold.mjs .tmp-test/repo >/dev/null
(cd .tmp-test/repo && node ../../skills/sdlc/scripts/new-task.mjs "Fix login timeout" bug >/dev/null)
TASKDIR=$(ls -d .tmp-test/repo/.sdlc/tasks/*/fix-login-timeout)
node -e "require('fs').writeFileSync('.tmp-test/findings.json', JSON.stringify([{dimension:'correctness',file:'src/x.js',line:12,severity:'high',claim:'null deref',verdict:'real'},{dimension:'security',file:'src/x.js',line:20,severity:'med',claim:'unvalidated input',verdict:'real'}]))"
node skills/sdlc/scripts/review.mjs write "$TASKDIR" .tmp-test/findings.json
node -e "require('fs').writeFileSync('.tmp-test/votes.json', JSON.stringify([{refuted:true},{refuted:true},{refuted:false}]))"
echo "verdict: $(node skills/sdlc/scripts/review.mjs verdict .tmp-test/votes.json)"
TD="$TASKDIR" node -e "const fs=require('fs');const md=fs.readFileSync(process.env.TD+'/review.md','utf8');if(!/src\/x\.js:12/.test(md))throw new Error('finding missing');if(!/# Review —/.test(md))throw new Error('header missing');console.log('review smoke OK')"
rm -rf .tmp-test
```
Expected: `wrote review.md with 2 finding(s)`, `verdict: refuted`, `review smoke OK`.

- [ ] **Step 3: Confirm clean**

Run: `git status --short` (expect empty; `.tmp-test/` is gitignored).

- [ ] **Step 4: Manual live acceptance (document, do not automate)**

Record in the report that the full Review path is validated by a human running, in a live
session, a task through to Review — confirming: reviewers fan out per dimension; findings
are adversarially verified; `review.md` is written; real findings loop back to Implement
(bumping `loops.review`) while a clean review reaches the gate and, on approval, advances to
`ship`. This needs live subagents and cannot run under `npm test`.

---

## Self-Review notes (author)

- **Spec coverage (M5 slice):** inline reviewer fan-out per `review.dimensions` ✓ (Tasks 2, 4); adversarial verifier + majority verdict ✓ (Tasks 1, 3, 4); deterministic dedupe/verdict/render/write ✓ (Task 1); review gate + real-findings loop-back bounded by `loops.max_review` ✓ (Task 4); wired into `/sdlc task` ✓ (Task 5); no Workflow-tool dependency ✓; index-first lazy memory + track scaling honored ✓.
- **Placeholders:** none — all files complete. `<SKILL_DIR>`/`<taskDir>` are documented runtime substitutions per M1–M4.
- **Type consistency:** finding shape `{dimension,file,line,severity,claim[,verdict]}` is consistent across `reviewer.md`, `review.mjs` (dedupe key + render), and `review.md`; verifier output `{refuted,reason}` feeds `verdict()`; guide invokes `review.mjs write|verdict`, `loop.mjs bump review`, `set-state.mjs phase implement|gate review approved|advance` — all real verbs. `review.dimensions`/`review.verify`/`gates.review`/`loops.max_review` are real `config.yml` keys.
- **Testability boundary explicit:** dedupe/verdict/render/write unit-tested (Task 1) + smoke (Task 6 Step 2); reviewer/verifier dispatch is documented manual acceptance (Task 6 Step 4).
```
