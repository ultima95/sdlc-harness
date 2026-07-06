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
5. Tell the user the task skeleton (`spec.md`, `progress.md`, `review.md`,
   `state.json`) is ready at phase `intake`. Driving the interactive phases
   (Intake → Spec & Plan → Implement → Test → Review → Ship, scaled by track)
   is added in later milestones.

### status
Show all tasks and their current phase/gate state.

1. Run: `node "<SKILL_DIR>/scripts/status.mjs"` from the repo root (`$(pwd)`).
2. Print the output verbatim.

### memory-refresh
Re-run Phase 0 to refresh Project Memory (e.g., after significant changes).
Follow `<SKILL_DIR>/phases/understand.md`; it overwrites the memory files.

### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.

## Notes
- All commands operate on the current working directory as the project root.
- If `.sdlc/` does not exist when running `task`/`status`, tell the user to run
  `/sdlc init` first.
