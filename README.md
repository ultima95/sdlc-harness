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
