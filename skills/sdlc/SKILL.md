---
name: sdlc
description: Run a gated software development life cycle for a repo. Use for `/sdlc init` (understand the codebase and scaffold project memory), `/sdlc task "<request>"` (start an issue/bug/feature through spec→implement→test→review→ship), `/sdlc status`, `/sdlc memory-refresh`, and `/sdlc resume`. Triggers on "sdlc", "run the lifecycle", "start a task", "sdlc init/status".
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
Scaffold `.sdlc/`, then run Phase 0 to build Project Memory.

1. Run: `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"` and report created vs. skipped.
2. Run **Phase 0 — understand the codebase**: follow `<SKILL_DIR>/phases/understand.md`
   to fan out explorer subagents, merge their findings, and populate `.sdlc/memory/`.
3. Report which memory files were populated and suggest the user skim
   `.sdlc/memory/index.md`.
4. Do **not** overwrite an existing config unless the user explicitly asks (`--force`).

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
5. The created task folder is `<taskDir>` (`.sdlc/tasks/<YYYYMMDD>/<slug>/`), at phase `intake`.
6. Run **Phase 1 — Intake & Clarify**: follow `<SKILL_DIR>/phases/intake.md` (pass
   `<taskDir>`). This is an interactive dialogue with the developer.
7. Run **Phase 2 — Spec & Plan**: follow `<SKILL_DIR>/phases/spec-plan.md` (pass
   `<taskDir>`), ending at the spec gate.
8. After the gate is approved (phase `implement`), run **Phase 3 — Implement**
   (`<SKILL_DIR>/phases/implement.md`; creates a `<type>/<slug>` feature branch per
   `git.branch`), **Phase 4 — Test** (`<SKILL_DIR>/phases/test.md`),
   **Phase 5 — Review** (`<SKILL_DIR>/phases/review.md`, review gate), then
   **Phase 6 — Ship** (`<SKILL_DIR>/phases/ship.md`). Ship pushes the branch and opens a PR or
   leaves commits (`ship.mode`), refreshes Project Memory, and moves the task to `shipped` (a
   branch awaiting merge) or `done`. When a `shipped` task's PR is merged, run **`/sdlc cleanup`**
   to verify the merge, delete the branch, return to base, and close the task.

### status
Show all tasks and their current phase/gate state.

1. Run: `node "<SKILL_DIR>/scripts/status.mjs"` from the repo root (`$(pwd)`).
2. Print the output verbatim.

### memory-refresh
Re-run Phase 0 to refresh Project Memory (e.g., after significant changes).
Follow `<SKILL_DIR>/phases/understand.md`; it overwrites the memory files.

### cleanup
Finish a `shipped` task after its PR was merged out-of-band.

1. Determine the task: if the user gave `<YYYYMMDD>/<slug>`, use it; else run
   `node "<SKILL_DIR>/scripts/resume.mjs" "$(pwd)"` and pick a task whose phase is `shipped`
   (ask the user if there are several).
2. Read its state: `node "<SKILL_DIR>/scripts/resume.mjs" "$(pwd)" "<taskId>"`; confirm the phase
   is `shipped`. If it is already `done`, tell the user the task is already cleaned up.
3. Follow **Phase 7 — Cleanup** (`<SKILL_DIR>/phases/cleanup.md`), passing the task folder.

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
   `review`→`phases/review.md`, `ship`→`phases/ship.md`,
   `shipped`→`phases/cleanup.md`. If `phase` is `done`, tell the
   user the task is already complete.
5. Continue the lifecycle from there.

## Notes
- All commands operate on the current working directory as the project root.
- If `.sdlc/` does not exist when running `task`/`status`, tell the user to run
  `/sdlc init` first.
