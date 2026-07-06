# Phase 1 — Intake & Clarify

Goal: turn a raw request into an agreed understanding, through dialogue with the
developer. This phase is INTERACTIVE — run by the conductor in the live session,
NOT a subagent. Scaled by the task's `track` (see `state.json` / `spec.md` front-matter).
`<SKILL_DIR>` is this skill's base directory; `<taskDir>` is the task folder.

Memory (index-first, lazy): read `.sdlc/memory/index.md` for orientation; load a
specific memory file only if it helps clarify the request (e.g., `modules.md` to
locate the affected area). Do NOT bulk-load `.sdlc/memory/`.

## Steps
1. Read the task's `spec.md` and `state.json`. Confirm phase is `intake`.
2. Analyze the request: restate it in one line and list what is ambiguous or unstated.
3. Ask the developer clarifying questions — scaled by `track`:
   - `full`: brainstorm thoroughly — requirements, approach, acceptance criteria, edge cases.
   - `fast`: 1–3 targeted questions only.
   - `hotfix`: confirm the bug and how to reproduce it; skip open-ended design questions.
   Ask one focused question at a time; prefer concrete options over open prompts.
4. When requirement and approach are agreed, record them into `spec.md` **Part 1 — Spec**
   (Summary, Context, Problem/Goal, Requirements, Acceptance criteria, Out of scope,
   Assumptions & resolved questions). Keep acceptance criteria testable.
5. Append a dated entry to `progress.md` capturing the intake outcome and key decisions.
6. Advance to Spec & Plan:
   `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `intake` → `spec_plan`), then follow `<SKILL_DIR>/phases/spec-plan.md`.

## Notes
- This phase is a conversation — do not guess when you can ask.
- Lock decisions under "Assumptions & resolved questions" so they aren't re-litigated later.
