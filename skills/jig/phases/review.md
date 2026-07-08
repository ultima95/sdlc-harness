# Phase 5 — Review

Goal: find real defects in the change, adversarially verify them, and gate shipping.
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder. Scaled by `track`.

Memory (index-first, lazy): load `conventions.md` (for the conventions dimension) and
`risks.md` (for correctness/security) as needed. Load only what you need.

## Steps
1. Confirm phase is `review`. Identify the change under review (the task's commits/diff
   since it started) and the acceptance criteria from `spec.md`.
2. **Fan out reviewers.** For each dimension in `.sdlc/config.yml` `review.dimensions`
   (default: correctness, security, tests, conventions), dispatch a `reviewer` subagent
   (role: `<SKILL_DIR>/agents/reviewer.md`) IN PARALLEL, one per dimension. Collect each
   one's JSON findings array. For `fast`/`hotfix` tracks, a single-pass reviewer is fine.
3. **Dedupe.** Merge all reviewer arrays and dedupe by dimension+file+line+claim (this is
   what `review.mjs` does when it writes the report).
4. **Adversarially verify.** If `review.verify` is `adversarial` (default), for each
   finding dispatch a `verifier` subagent (role: `<SKILL_DIR>/agents/verifier.md`). Decide
   each finding's `verdict` with the majority-refute rule — write the verifier votes to a
   JSON file and run `node "<SKILL_DIR>/scripts/review.mjs" verdict <votes.json>` (prints
   `real` or `refuted`). Keep the `verdict` on each finding.
5. **Write the report.** Put the final findings (each with its `verdict`) in a JSON file and
   run `node "<SKILL_DIR>/scripts/review.mjs" write "<taskDir>" <findings.json>` to write
   `review.md`. When `git.track_sdlc`, commit `review.md` with the `.sdlc/` state (see SKILL.md
   § Committing `.sdlc/` state) — a standalone `.sdlc/` commit on a clean pass; when looping
   back to Implement, the fix commits there carry it.
6. **Decide:**
   - **Confirmed `real` findings exist:** bump the loop
     (`node "<SKILL_DIR>/scripts/loop.mjs" "<taskDir>" bump review`) and compare to
     `loops.max_review` (default 2). Under the limit → go back to Implement
     (`node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" phase implement`) to fix them,
     then re-run Test and Review. At/over the limit → STOP and escalate to the developer.
   - **Clean (no `real` findings):** this is the **review gate**. Per `.sdlc/config.yml`
     `gates.review`: `hard` (default) and track not `hotfix` → present the change summary
     and ask the developer to APPROVE to ship. `soft`/`off` or `hotfix` → proceed.
     On approval:
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" gate review approved` then
     `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance` (phase `review` → `ship`).
7. Report the outcome (looped back to Implement, or gate approved → phase `ship`).
   Continue with the Ship phase (`<SKILL_DIR>/phases/ship.md`).

## Notes
- Only verified `real` findings loop back — refuted findings are dropped so plausible-but-wrong
  ones don't churn the loop.
- Never approve the review gate with unfixed `real` findings.
