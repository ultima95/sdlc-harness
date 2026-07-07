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
2. **Create the feature branch** (per `.sdlc/config.yml` `git.branch`, default `true`).
   Skip this step entirely in a non-git repo or when `git.branch: false`, and note "worked on
   the current branch" in `progress.md`. Otherwise:
   - Resolve the base branch: use `git.base` if set; else the repo default via
     `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the `origin/` prefix); else the
     current branch name.
   - Ensure the working tree is clean (`git status --porcelain` is empty). If it is dirty, STOP
     and ask the developer to commit or stash — do not auto-stash.
   - Create and check out the branch off the base: `git checkout -b <type>/<slug>`. The name is
     `<task type>/<task slug>` — e.g. `feature/add-oauth-login` (see `scripts/lib/git.mjs`
     `branchName`).
   - Record it: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" field branch <type>/<slug>`
     then `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" field base <base>`.
3. For each Step in order:
   - Subagent-driven: dispatch a fresh implementer subagent with the step text, the
     relevant memory context, and the acceptance criterion it serves. Have it write
     code + tests and report; review, and re-dispatch with fixes if needed.
   - Inline: make the change yourself, following `conventions.md`.
   Commit per step (or per logical unit).
4. Append a dated entry to `progress.md` (mode used, branch created, steps done, commits made).
5. Advance to Test: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `implement` → `test`), then follow `<SKILL_DIR>/phases/test.md`.

## Notes
- Keep each subagent scoped to ONE step; don't let it wander outside the plan.
- Do not skip the plan's Test plan — the Test phase enforces "a test proves the change".
