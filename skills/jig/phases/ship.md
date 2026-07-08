# Phase 6 — Ship

Goal: finalize and ship the change, refresh Project Memory, and close the task.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder. Scaled by `track`.

Memory: this phase UPDATES memory (step 4) rather than bulk-reading it.

## Steps
1. Confirm phase is `ship` and the review gate is approved (`gate_review: approved`), or
   the track/config waived it. Ensure tests are green.
2. **Finalize, push, and open the PR.** Make sure all work is committed on the feature branch —
   including the task's `.sdlc/` state (`spec.md`/`progress.md`/`review.md`/`state.json`) when
   `git.track_sdlc`. Read `git.*` and `ship.mode` from `.sdlc/config.yml`. `trust_level` governs confirmations:
   `strict` → confirm push AND PR; `normal` → push auto, confirm PR; `trusted` → both auto.
   - **Push** the branch if `git.push` (default `true`): `git push -u origin <branch>` (confirm
     first when `trust_level: strict`). Skip in a non-git repo or when there is no remote.
   - **`ship.mode: pr`** — open a pull request against the base (confirm unless `trusted`):
     `gh pr create --base <base> --head <branch>` — title as a **Conventional Commit** summary
     derived from the task (`type(scope): subject`, e.g. `feat: add OAuth login`) so a
     squash-merge produces a conventional commit; body summarizing the change + the `spec.md`
     acceptance criteria. If `.github/PULL_REQUEST_TEMPLATE.md` exists, fill it instead of
     writing free-form. Record the PR and report its URL:
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" field pr <number-or-url>`.
   - **`ship.mode: commit`** — leave the pushed branch for the developer to merge/PR manually.
3. **Update docs** if the change affects user-facing docs (README, etc.).
4. **Refresh Project Memory** (invariant — memory must never go stale). Per
   `.sdlc/config.yml` `memory.refresh` (default `on_ship`):
   - `on_ship`: apply targeted, index-first updates to the memory files the change touched
     — adjust entries in `modules.md`, `architecture.md`, `risks.md`, `conventions.md`, or
     `glossary.md` for what actually changed. Don't rewrite everything. For a large or
     structural change, run a full re-index instead: `/sdlc memory-refresh`.
   - `manual`: skip here; the developer runs `/sdlc memory-refresh` when they choose.
5. Record the outcome:
   `node "<SKILL_DIR>/scripts/progress.mjs" "<taskDir>" ship "<what shipped: branch/PR + memory refreshed>"`
   Then, when `git.track_sdlc`, commit the refreshed `.sdlc/` (memory + progress + state) on the
   feature branch — a standalone `.sdlc/` commit — and `git push` so it's part of the PR (see
   SKILL.md § Committing `.sdlc/` state).
6. Close or hand off — depends on whether there is a branch to clean up later:
   - If a feature branch exists (a `branch` is recorded in `state.json`) AND `git.cleanup:
     on_merge` (default): advance to `shipped` —
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance` (phase `ship` → `shipped`).
     Tell the developer to run `/sdlc cleanup <taskId>` once the PR is merged.
   - Otherwise (no branch — non-git / `git.branch: false` — or `git.cleanup: off`): close the
     task directly — `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" phase done`.
7. Report: what shipped (branch + commit/PR URL), which memory files were refreshed, and whether
   the task is `shipped` (awaiting merge + cleanup) or `done`.

## Notes
- Never ship with unresolved `real` review findings or failing tests.
- The two invariants close here: a test proved the change (Test phase), and Ship refreshed
  Project Memory (step 4).
