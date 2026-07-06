# Phase 6 — Ship

Goal: finalize and ship the change, refresh Project Memory, and close the task.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder. Scaled by `track`.

Memory: this phase UPDATES memory (step 4) rather than bulk-reading it.

## Steps
1. Confirm phase is `ship` and the review gate is approved (`gate_review: approved`), or
   the track/config waived it. Ensure tests are green.
2. **Finalize the change.** Make sure all work is committed. Then per `.sdlc/config.yml`
   `ship.mode` (default `commit`):
   - `commit`: leave the commits on the current branch for the developer to merge.
   - `pr`: open a pull request with `gh pr create` — title from the task, body summarizing
     the change and the acceptance criteria. Report the PR URL.
3. **Update docs** if the change affects user-facing docs (README, etc.).
4. **Refresh Project Memory** (invariant — memory must never go stale). Per
   `.sdlc/config.yml` `memory.refresh` (default `on_ship`):
   - `on_ship`: apply targeted, index-first updates to the memory files the change touched
     — adjust entries in `modules.md`, `architecture.md`, `risks.md`, `conventions.md`, or
     `glossary.md` for what actually changed. Don't rewrite everything. For a large or
     structural change, run a full re-index instead: `/sdlc memory-refresh`.
   - `manual`: skip here; the developer runs `/sdlc memory-refresh` when they choose.
5. Record the outcome:
   `node "<SKILL_DIR>/scripts/progress.mjs" "<taskDir>" ship "<what shipped: commit/PR + memory refreshed>"`
6. Close the task: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `ship` → `done`).
7. Report: what shipped (commit or PR URL), which memory files were refreshed, and that the
   task is `done`.

## Notes
- Never ship with unresolved `real` review findings or failing tests.
- The two invariants close here: a test proved the change (Test phase), and Ship refreshed
  Project Memory (step 4).
