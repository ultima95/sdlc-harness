---
name: sdlc
description: Run a gated software development life cycle for a repo. Use for `/sdlc init` (understand the codebase and scaffold project memory), `/sdlc task "<request>"` (start an issue/bug/feature through spec→implement→test→review→ship), `/sdlc status`, and `/sdlc resume`. Triggers on "sdlc", "run the lifecycle", "start a task", "sdlc init/status".
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
Scaffold the harness data directory for this repo.

1. Run: `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"`
2. Report which files were created vs. skipped.
3. Tell the user: Project Memory files under `.sdlc/memory/` are empty stubs.
   Populating them (Phase 0 investigation) is added in a later milestone; for now
   they are placeholders they may edit by hand.
4. Do **not** overwrite an existing config unless the user explicitly asks; then
   re-run with `--force`.

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

### resume
Not implemented in this milestone. Tell the user resume arrives with the
inner-loop phases in a later milestone, and point them at `/sdlc status`.

## Notes
- All commands operate on the current working directory as the project root.
- If `.sdlc/` does not exist when running `task`/`status`, tell the user to run
  `/sdlc init` first.
