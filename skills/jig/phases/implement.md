# Phase 3 — Implement

Goal: implement the plan from `spec.md` Part 2. Offers two modes; scaled by `track`.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): read `.jig/memory/index.md`; load `conventions.md`
before writing code and `modules.md` / `risks.md` for the touched areas. Load only
what you need.

## Choose a mode
Ask the developer which mode (unless the choice is obvious). Default: subagent-driven.
- **Subagent-driven (recommended)** — delegate each ordered Step in `spec.md` Part 2
  to a FRESH subagent that implements just that step (TDD where sensible, self-review,
  commit). Review each subagent's result before dispatching the next. Best for
  multi-step or larger changes; keeps the main agent's context lean.
- **Inline** — implement the steps directly in this session. Best for tiny changes
  (e.g., a one-line fix) or the `hotfix` track.
Record the chosen mode in `progress.md`.

## Steps
1. Confirm phase is `implement` and `spec.md` Part 2 (Plan) has ordered Steps.
2. **Create the feature branch** (per `.jig/config.yml` `git.branch`, default `true`).
   Skip this step entirely in a non-git repo or when `git.branch: false`, and note "worked on
   the current branch" in `progress.md`. Otherwise:
   - **Resolve the base branch:** use `git.base` if set; else the repo default via
     `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the `origin/` prefix); else the
     current branch name. The remote is `origin`. Prefer an explicit `git.base` (e.g. `main`):
     when `base: auto` and `origin/HEAD` isn't set locally (some clones / fresh CI), the chain
     falls back to the *current* branch — which, right after a push, is the just-worked feature
     branch, silently stacking the next task on unmerged work.
   - **Starting-point gate.** Detect repo-state anomalies before cutting the branch:
     - **Dirty tree outside `.jig/`:** run `git status --porcelain`; any dirty path **not** under
       `.jig/` is an anomaly. (When `.jig/` is tracked, outstanding bookkeeping from Intake/Spec &
       Plan is expected — it rides onto the new branch and folds into the first commit below.)
     - **Detached HEAD:** `git symbolic-ref -q HEAD` exits non-zero ⇒ anomaly.

     On any anomaly, act by the task's `track` (from `state.json`):
     - **full / fast:** **STOP** and ask the developer to commit/stash or switch to a branch.
       Do **not** auto-stash and do **not** auto-proceed.
     - **hotfix:** note the anomaly in `progress.md` and proceed.
   - **Cut the branch from the resolved base** per `git.branch_from` (default `remote`). The name
     is `<task type>/<task slug>` — e.g. `feature/add-oauth-login` (see `scripts/lib/git.mjs`
     `branchName`):
     - **`remote`:** fetch then branch off the remote-tracking ref —
       `git fetch origin <base>` then `git checkout -b <type>/<slug> origin/<base>`
       (see `fetchBaseCmd` / `checkoutFromCmd`). If the fetch fails or `origin/<base>` doesn't
       exist (offline, or the base is local-only), **fall back to `local`**, note the fallback in
       `progress.md`, and continue.
     - **`local`:** branch off the local base ref — `git checkout -b <type>/<slug> <base>`
       (see `checkoutFromCmd`).
   - Record it: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" field branch <type>/<slug>`
     then `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" field base <base>`.
3. For each Step in order:
   - Subagent-driven: dispatch a fresh implementer subagent with the step text, the
     relevant memory context, and the acceptance criterion it serves. Have it write
     code + tests and report; review, and re-dispatch with fixes if needed.
   - Inline: make the change yourself, following `conventions.md`.
   Commit per step (or per logical unit) using **Conventional Commits** —
   `type(scope): subject` (e.g. `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`),
   imperative subject ≤ ~50 chars — unless `.jig/memory/conventions.md` records a different
   commit convention for this repo, which takes precedence.
   **When `.jig/` is tracked (`git.track_state`), commit its state *with* the code, not as a
   trailing pile** (see SKILL.md § Committing `.jig/` state):
   - Inline: `git add <code> .jig/` so each commit carries its progress/spec updates; the first
     commit also sweeps the Intake/Spec & Plan bookkeeping that rode onto the branch.
   - Subagent-driven: the implementer commits its code step; the main agent folds the `.jig/`
     updates into the phase's commits (add `.jig/` to the final step's commit, or one `.jig/`
     commit right after) so nothing is left uncommitted.
4. Append a dated entry to `progress.md` (mode used, branch created, steps done, commits made).
5. Advance to Test: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `implement` → `test`), then follow `<SKILL_DIR>/phases/test.md`.

## Notes
- Keep each subagent scoped to ONE step; don't let it wander outside the plan.
- Do not skip the plan's Test plan — the Test phase enforces "a test proves the change".
