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
- Node.js >= 18 (used by the harness's bundled scripts)

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
