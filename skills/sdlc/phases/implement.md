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
2. For each Step in order:
   - Subagent-driven: dispatch a fresh implementer subagent with the step text, the
     relevant memory context, and the acceptance criterion it serves. Have it write
     code + tests and report; review, and re-dispatch with fixes if needed.
   - Inline: make the change yourself, following `conventions.md`.
   Commit per step (or per logical unit).
3. Append a dated entry to `progress.md` (mode used, steps done, commits made).
4. Advance to Test: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `implement` → `test`), then follow `<SKILL_DIR>/phases/test.md`.

## Notes
- Keep each subagent scoped to ONE step; don't let it wander outside the plan.
- Do not skip the plan's Test plan — the Test phase enforces "a test proves the change".
