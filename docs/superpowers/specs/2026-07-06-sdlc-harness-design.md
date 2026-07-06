# SDLC Harness — Design

**Date:** 2026-07-06
**Status:** Approved (design), pending implementation plan
**Author:** brainstormed with Claude

## 1. Summary

A self-contained, portable **software development life cycle (SDLC) harness** for AI coding agents, shipped as a single Claude Code skill installed with `npx skills add <repo>`.

The harness works in two layers:

1. **Phase 0 — Understand the codebase** (run once per repo, refreshable): investigate the repository and persist durable **Project Memory** so every later phase starts with real context.
2. **Inner loop — per task** (repeats for each issue / bug / feature): the conductor drives a task through **Intake & Clarify → Spec & Plan 🚦 → Implement ⇄ Test → Review 🚦 → Ship**, with hard-but-configurable human gates, bounded retry loops, and resumable state.

It is built fresh (not wired to any personal skill collection), tech-stack agnostic (build/test commands come from config), and portable: `npx skills` delivers the logic, and the harness self-scaffolds its data directory on first run.

## 2. Goals & non-goals

**Goals**
- One installable skill that gives any repo a repeatable, gated SDLC for AI agents.
- A durable, human-readable project knowledge base that grounds every task.
- Human control at the two decisions that matter most (approve plan, approve ship), with an escape hatch for low-risk work.
- Resumable tasks: work can pause and continue across sessions from persisted state.
- Portable and shareable across projects and teammates via `npx skills`.

**Non-goals (v1)**
- Not a greenfield project generator (Phase 0 assumes an existing/brownfield codebase).
- Not a standalone CLI outside Claude Code, and not a deterministic batch engine that removes humans from the loop.
- Not a replacement for GSD/superpowers; it deliberately does not depend on them.
- No multi-repo orchestration; one harness instance per repo.

## 3. Key decisions & trade-offs

| Decision | Chosen | Alternatives | Why chosen |
|---|---|---|---|
| Relationship to existing tools | **Build fresh, self-contained** | Orchestrate existing / Hybrid | Portable and shareable; no dependency on the author's personal `.claude` collection |
| Control model | **Hybrid playbook + engine** | Playbook-only / Engine-only | Keeps human gates and per-task brainstorming while using multi-agent fan-out where it pays off; engine-only fights interactive gates |
| Unit of work | **Phase 0 (understand) + per-task loop** | Single task only / Whole project | Matches the intent: understand the codebase first, then let developers run tasks against it |
| Memory store | **Markdown source of truth + optional graph index** | Markdown-only / Graph-only | Portable, git-versioned truth plus optional structural-query power when an MCP graph is present; graph-only is not portable |
| Build approach | **Skill-driven conductor (A)** | Workflow-engine (B) / Standalone CLI (C) | Native to Claude Code, portable by install, interactive at gates; B is batchy, C reinvents subagents/skills |
| Gate policy | **Hard by default, configurable** | Always hard / Soft | Safe default with a per-task escape hatch for speed |
| Spec & Plan | **One merged `spec.md`, one gate** | Two separate phases/files | Fewer files, single review point covers what + how |
| Task folder layout | **`.sdlc/tasks/<YYYYMMDD>/<slug>/`** | Opaque `<id>` | Human-findable, sorts chronologically |
| Distribution | **`npx skills add <repo>`; skill self-scaffolds `.sdlc/`** | `install.sh` / manual copy / git submodule | Matches the chosen tool; one command, atomic updates via `npx skills update` |
| Packaging granularity | **Single conductor skill** | Per-phase skills / Hybrid split | One install unit, no cross-skill shared-state tax; slim SKILL.md loads phase guides on demand. Growth path: extract `understand`/`review` later if needed |
| Work-size scaling | **Track presets (full/fast/hotfix)** | Dynamic per-task / Gate-config only | Predictable, auditable, configurable; extends `type`; avoids forcing a hotfix through the full gated loop |

## 4. Architecture

The harness is authored as **one skill** named `sdlc`. `npx skills` installs the skill directory (with all bundled resources) as a unit. All harness logic lives inside skills because the `npx skills` CLI installs *only* SKILL.md-based skills — it does not install slash commands, `agents/`, hooks, MCP servers, or standalone workflow scripts.

### 4.1 Source repo layout (what `npx skills` installs from)

```
skills/
  sdlc/                     # the one installed skill; invocable as /sdlc
    SKILL.md                # slim conductor: dispatch init | task | resume | status
    phases/                 # loaded on demand, one per phase
      understand.md  intake.md  spec-plan.md
      implement.md   test.md    review.md   ship.md
    agents/                 # role prompts, spawned inline via the Agent tool
      explorer.md  reviewer.md  verifier.md
    workflows/              # invoked via the Workflow tool's scriptPath
      understand.js  review.js
    templates/              # written into .sdlc on scaffold
      config.yml  spec.md  progress.md  review.md
      memory/               # architecture.md, modules.md, conventions.md,
                            # glossary.md, runbook.md, risks.md, index.md
.claude-plugin/
  marketplace.json          # optional: declares the skill path for marketplaces
fixtures/                   # sample repo used to dogfood the harness (not a skill)
README.md
```

### 4.2 Runtime data (created in the target repo by `/sdlc init`)

```
.sdlc/
  config.yml                # gates, build/test commands, trust level, loop limits
  memory/                   # 📦 Project Memory (markdown; optional graph index)
    architecture.md  modules.md  conventions.md  glossary.md
    runbook.md  risks.md  index.md
  tasks/
    <YYYYMMDD>/
      <slug>/
        spec.md             # Spec + Plan (one gate)
        progress.md         # append-only running log
        review.md           # review findings + verdicts
        state.json          # phase + gate status (resume brain)
```

`.sdlc/` is **not** installed by the CLI; the conductor scaffolds it on first run. The skill (logic) is delivered by `npx skills`; the data is per-repo and git-versioned by the target project.

### 4.3 The conductor

`SKILL.md` is a slim dispatcher. It parses the sub-command from the skill args and, for a task, reads `state.json` to find the current phase, then loads only that phase's guide from `phases/`. This keeps context lean even though the skill bundles the entire lifecycle.

Entry sub-commands (invoked as a single skill with args):
- `/sdlc init` — run Phase 0; scaffold `.sdlc/`; build Project Memory.
- `/sdlc task "<request>"` (or an issue reference) — start a new task's inner loop.
- `/sdlc resume [<YYYYMMDD>/<slug>]` — resume a paused task from `state.json`.
- `/sdlc status` — list tasks and their current phase/gate state.
- `/sdlc memory-refresh` — re-run Phase 0 (full or incremental) to fight drift.

## 5. Phase 0 — Understand the codebase

Run once per repo, refreshable. Produces **Project Memory**.

1. **Investigate** — the conductor dispatches parallel `explorer` subagents (Agent tool, prompt from `agents/explorer.md`), each mapping a slice: structure & entry points, tech stack & dependencies, key runtime flows, build/test/run mechanics, and fragile/risky areas. Heavy fan-out uses `workflows/understand.js` (Workflow tool).
2. **Extract** — synthesize explorer output into the memory documents (architecture, modules, conventions, glossary, runbook, risks).
3. **Persist** — write `.sdlc/memory/*.md`. If a code-graph MCP is available and `memory.graph` is `auto`/`on`, also build a graph index for structural queries; otherwise fall back to markdown only.

**Project Memory artifacts:** `architecture.md` (system map, boundaries), `modules.md` (module index + purpose), `conventions.md` (style, patterns, idioms), `glossary.md` (domain terms), `runbook.md` (how to build/run/test), `risks.md` (fragile areas, gotchas), `index.md` (entry point / TOC).

Every inner-loop phase reads from Project Memory. Ship updates it so it never goes stale.

## 6. Inner loop — per task

| # | Phase | What it does | Human involvement |
|---|---|---|---|
| 1 | **Intake & Clarify** | Analyze the developer's request; brainstorm *with* them; ask questions until requirement and approach are agreed | Interactive dialogue |
| 2 | **Spec & Plan** | Write the agreed requirement (acceptance criteria) + approach, affected files, ordered steps, test plan, risks/rollback into `spec.md` | 🚦 Hard gate: approve plan |
| 3 | **Implement** | Write the code, grounded in memory and the plan (TDD optional) | — |
| 4 | **Test** | Run/author tests; loop back to Implement on failure | — |
| 5 | **Review** | Multi-dimension fan-out review (`workflows/review.js`), adversarially verify findings, write `review.md`; loop back to Implement for confirmed findings | 🚦 Hard gate: approve to ship |
| 6 | **Ship** | Commit / open PR, update docs, refresh Project Memory | — |

Loops: **Implement ⇄ Test** (fix failures), **Review → Implement** (fix confirmed findings), **Ship → Memory** (keep memory current).

### 6.1 Tracks — scaling the loop by work size

Not every task deserves the full gated loop. Each task carries a **track** that scales which phases run and how heavy the gates are. The track is auto-suggested from `type` at Intake and is human-overridable. `type` describes the *nature* of the work (feature/bug/chore/refactor); `track` describes the *process weight*.

| Track | Intake | Spec & Plan | Implement | Test | Review | Ship | Gates |
|---|---|---|---|---|---|---|---|
| **full** | brainstorm dialogue | full `spec.md` | ✓ | full | fan-out + verify | PR | both **hard** |
| **fast** | 1–3 quick questions | light spec (summary + acceptance + steps only) | ✓ | ✓ | single-pass review | commit/PR | spec **soft**, review **hard-lite** |
| **hotfix** | confirm bug + repro | one-line inline note, no gate | ✓ | **regression test for the fix** (never skipped) | quick self-review | commit + fast ship | both **soft** |

**Invariants no track may drop:** (1) a test that proves the change; (2) Ship refreshes Project Memory.

**Default track by type** (set in `config.yml`, overridable per task): `feature → full`, `refactor → full`, `bug → fast`, `chore → fast`. The `hotfix` track is selected explicitly for urgent work (typically `type: bug`). The conductor proposes the default at Intake and asks for confirmation before proceeding.

## 7. State, gates, and error handling

### 7.1 `state.json` — the resume brain

```json
{
  "task": "20260706/fix-login-timeout",
  "type": "bug",
  "track": "fast",
  "phase": "implement",
  "gates": { "spec_plan": "approved", "review": "pending" },
  "loops": { "test": 1, "review": 0 },
  "updated": "2026-07-06T14:22:00Z"
}
```

`phase` ∈ `intake | spec_plan | implement | test | review | ship | done`. On `/sdlc task` or `/sdlc resume`, the conductor reads `state.json`, jumps to the current phase, runs its skill guide, updates state, then either stops at a gate or advances.

### 7.2 `spec.md` template

YAML front-matter carries machine-readable state (`id`, `type`, `track`, `status`, `created`, `gate_spec_plan`, mirroring `state.json`). Body has two parts:

- **Part 1 — Spec (the contract):** Summary · Context (links into memory) · Problem/Goal (distilled from Intake) · Requirements (numbered) · **Acceptance criteria** (testable definition of done) · Out of scope · Assumptions & resolved questions.
- **Part 2 — Plan (execution):** Approach + why (alternatives considered) · Affected files & modules (from `modules.md`/`risks.md`) · ordered Steps mapped to files · Test plan (each acceptance criterion → a test) · Risks & rollback.

Sections scale to the task — a one-line bug fills a few; a feature fills all.

### 7.3 Supporting task files
- **`progress.md`** — append-only, dated log: each phase records what it did, decisions, commands run, and test results. Serves as audit trail and resume context.
- **`review.md`** — findings table: dimension · `file:line` · severity · claim · verifier verdict (real/refuted) · fix status.

### 7.4 Gates

Hard by default, configured in `config.yml` (`gates.spec_plan`, `gates.review` ∈ `hard | soft | off`) with a `trust_level` posture. A per-run override loosens gates for low-risk work (e.g. `/sdlc task --auto`).

- **Spec gate:** after `spec.md` is written, the conductor stops, shows Summary + Acceptance criteria + Plan steps, and asks *approve / revise*. Approve → advance to Implement.
- **Review gate:** after `review.md`, if clean it asks *approve to ship*; if confirmed findings exist, it loops back to Implement.

### 7.5 Error handling & loops (bounded, then escalate)
- **Implement ⇄ Test:** run the test command from config; failures feed back into Implement; capped at `loops.max_test` (default 3) → then pause and surface to the human.
- **Review → Implement:** only *confirmed* findings loop back; capped at `loops.max_review` (default 2).
- **Any exhausted retry, ambiguity, or uncaught error → pause:** write `state.json` and hand back to the human with context. `/sdlc resume` reconstructs from `state.json` + memory + `progress.md`.

## 8. Subagents & workflows

- **Subagents** are spawned inline via the Agent tool using role prompts bundled in `agents/` (`explorer`, `reviewer`, `verifier`). No installed `agents/` directory is required, so the harness stays fully contained in one skill.
- **Workflow scripts** (`workflows/understand.js`, `workflows/review.js`) are bundled resource files invoked via the Workflow tool's `scriptPath`. They are used *surgically* — only for the two genuinely fan-out-heavy phases (Phase 0 investigation and Review). Review uses a find → adversarially-verify pattern so plausible-but-wrong findings don't survive.

## 9. Configuration

`.sdlc/config.yml`:

```yaml
project:
  build: "npm run build"
  test:  "npm test"
  lint:  "npm run lint"
gates:
  spec_plan: hard        # hard | soft | off
  review:    hard
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
  graph:   auto          # auto | on | off (use MCP graph if present)
  refresh: on_ship       # on_ship | manual
review:
  dimensions: [correctness, security, tests, conventions]
  verify: adversarial     # spawn verifiers to refute findings
```

## 10. Testing the harness

The harness is markdown skills + bundled JS workflows, so "tests" are behavior checks:
- A small `fixtures/` sample repo committed in the source repo for **dogfooding**.
- Smoke checks: `/sdlc init` produces memory; a sample `/sdlc task` walks the phases; `state.json` transitions correctly; gates stop; `/sdlc resume` restores mid-phase; loop limits escalate as configured.
- Each skill/guide validated with the `writing-skills` discipline.

## 11. Open questions (resolve during planning)
- Task source formats for `/sdlc task`: free-text request vs. issue reference (e.g. GitHub) — how far to support in v1.
- Slug generation rules and same-day collision handling (`-2` suffix confirmed; who generates the slug — conductor from the request title).
- Exact shape of the optional graph index and which MCP it targets when `memory.graph` is enabled.
- Whether Ship opens a PR or only commits by default (config-driven).

## 12. Milestones (for the implementation plan)
1. Skill skeleton: `sdlc` SKILL.md dispatcher + `.sdlc/` scaffolding on `/sdlc init`.
2. Phase 0: explorer fan-out + memory synthesis + `understand.js`.
3. Inner-loop phases 1–2 (Intake, Spec & Plan) + spec gate + `spec.md` template.
4. Inner-loop phases 3–4 (Implement, Test) + implement⇄test loop.
5. Review phase + `review.js` fan-out/verify + review gate.
6. Ship phase + memory refresh.
7. Resume/status, config wiring, fixtures + dogfood smoke checks, `marketplace.json`.
